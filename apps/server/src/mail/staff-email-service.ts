import { randomUUID } from "node:crypto";
import type { Request, Response } from "express";
import { isValidEmailAddress, type StaffEmailSendResult } from "@vega/domain";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { htmlToPlainText, sanitizeEmailHtml } from "./email-template.js";
import { MailDeliveryError } from "./hostinger-mail-client.js";
import { deliverOutboxMail, queueMail, recoverStaleMailClaims, type QueueMailInput } from "./mail-outbox-service.js";
import type { MailService } from "./mail-service.js";

export interface StaffEmailInput {
  to: string;
  subject: string;
  contentHtml: string;
  idempotencyKey: string;
}

export type StaffEmailValidation = { ok: true; value: StaffEmailInput } | { ok: false; issues: Array<{ field: string; message: string }> };

const SUBJECT_MAX = 200;
const CONTENT_MAX = 200_000;

/** Validates the editable part of a staff mail; recipient and content are never logged. */
export function validateStaffEmailInput(body: unknown): StaffEmailValidation {
  const record = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  const issues: Array<{ field: string; message: string }> = [];
  const to = typeof record.to === "string" ? record.to.trim().toLowerCase() : "";
  if (!to || to.length > 254 || !isValidEmailAddress(to)) issues.push({ field: "to", message: "Bitte geben Sie eine gültige Empfängeradresse ein." });
  const subject = typeof record.subject === "string" ? record.subject.trim() : "";
  if (!subject || subject.length > SUBJECT_MAX || /[\r\n]/u.test(subject)) issues.push({ field: "subject", message: `Der Betreff ist erforderlich (max. ${SUBJECT_MAX} Zeichen, einzeilig).` });
  const rawHtml = typeof record.contentHtml === "string" ? record.contentHtml : "";
  const contentHtml = rawHtml.length <= CONTENT_MAX ? sanitizeEmailHtml(rawHtml) : "";
  if (!htmlToPlainText(contentHtml)) issues.push({ field: "contentHtml", message: "Der E-Mail-Text darf nicht leer oder zu lang sein." });
  const idempotencyKey = typeof record.idempotencyKey === "string" ? record.idempotencyKey : "";
  if (!/^[A-Za-z0-9-]{16,100}$/u.test(idempotencyKey)) issues.push({ field: "idempotencyKey", message: "Ungültige Versandkennung." });
  return issues.length ? { ok: false, issues } : { ok: true, value: { to, subject, contentHtml, idempotencyKey } };
}

export type StaffSendResult = StaffEmailSendResult;

/**
 * Queues and immediately delivers one staff mail. `scope` namespaces the
 * client key per document so a reused key can never resolve to another
 * document's outbox row. A repeated request with the same key reports the
 * stored state instead of sending twice; attachments are only built for a new row.
 */
export async function sendStaffEmail(
  mailService: MailService,
  scope: string,
  idempotencyKey: string,
  build: () => Promise<Omit<QueueMailInput, "idempotencyKey">>,
): Promise<{ outboxId: string; result: StaffSendResult }> {
  const key = `staff:${scope}:${idempotencyKey}`;
  const existing = await prisma.emailOutbox.findUnique({ where: { idempotencyKey: key }, select: { id: true } });
  const outboxId = existing?.id ?? await queueMail({ ...await build(), idempotencyKey: key });
  try {
    if (await deliverOutboxMail(outboxId, mailService) === "sent") return { outboxId, result: { status: "SENT" } };
  } catch (error) {
    if (!(error instanceof MailDeliveryError)) {
      return { outboxId, result: { status: "UNKNOWN", errorCode: "MAIL_OUTBOX_STATE_UNAVAILABLE" } };
    }
    return { outboxId, result: error.outcome === "UNKNOWN"
      ? { status: "UNKNOWN", errorCode: error.code }
      : error.retryable ? { status: "RETRY_SCHEDULED", errorCode: error.code }
      : { status: "FAILED", errorCode: error.code } };
  }
  const row = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: outboxId }, select: { status: true, lastErrorCode: true } });
  return { outboxId, result: storedSendResult(row) };
}

function storedSendResult(row: { status: string; lastErrorCode: string | null }): StaffSendResult {
  if (row.status === "NOT_QUEUED") return { status: "NOT_QUEUED" };
  if (row.status === "SENT") return { status: "SENT" };
  if (row.status === "SENDING" || row.status === "PENDING") return { status: "SENDING" };
  if (row.status === "UNKNOWN") return { status: "UNKNOWN", errorCode: row.lastErrorCode ?? "MAIL_SEND_UNCERTAIN" };
  if (row.status === "REJECTED") return { status: "FAILED", errorCode: row.lastErrorCode ?? "MAIL_SEND_REJECTED" };
  return { status: "RETRY_SCHEDULED", errorCode: row.lastErrorCode ?? "MAIL_SEND_FAILED" };
}

/** A status check never builds or sends mail, even if the first request was lost. */
export async function checkStaffEmailStatus(
  scope: string,
  idempotencyKey: string,
  references: { orderId?: string; reminderEventId?: string; actorName?: string } = {},
): Promise<{ outboxId: string; result: StaffSendResult }> {
  if (!/^[A-Za-z0-9-]{16,100}$/u.test(idempotencyKey)) throw new Error("INVALID_MAIL_STATUS_KEY");
  const key = `staff:${scope}:${idempotencyKey}`;
  let row: { id: string };
  try {
    row = await prisma.emailOutbox.upsert({
      where: { idempotencyKey: key },
      create: {
        id: randomUUID(), idempotencyKey: key, ...references,
        kind: "MAIL_CANCELLED", status: "NOT_QUEUED", recipients: [], subject: "", contentHtml: "", nextAttemptAt: new Date(),
      },
      update: {},
      select: { id: true },
    });
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    row = await prisma.emailOutbox.findUniqueOrThrow({ where: { idempotencyKey: key }, select: { id: true } });
  }
  // The terminal tombstone fences a delayed POST (including PDF generation
  // already in flight) before explicitly permitting a new draft/key.
  await recoverStaleMailClaims(new Date(), row.id);
  const stored = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: row.id }, select: { status: true, lastErrorCode: true } });
  return { outboxId: row.id, result: storedSendResult(stored) };
}

export async function respondWithStaffEmailStatus(
  req: Request,
  res: Response,
  scope: string,
  references: { orderId?: string; reminderEventId?: string } = {},
): Promise<void> {
  const key = req.body?.idempotencyKey;
  if (typeof key !== "string" || !/^[A-Za-z0-9-]{16,100}$/u.test(key)) {
    invalidEmail(res, [{ field: "idempotencyKey", message: "Ungültige Versandkennung." }]);
    return;
  }
  const { outboxId, result } = await checkStaffEmailStatus(scope, key, { ...references, actorName: String(res.locals.staffUser.name) });
  respondWithSendResult(req, res, outboxId, result);
}

export function respondWithSendResult(req: Request, res: Response, outboxId: string, result: StaffSendResult): void {
  res.setHeader("Cache-Control", "no-store");
  if (result.status === "SENT" || result.status === "NOT_QUEUED") {
    res.json({ data: { ...result, outboxId } });
    return;
  }
  // Only the outbox id and machine code are logged, never recipients or content.
  if ("errorCode" in result) req.log.warn({ outboxId, code: result.errorCode }, "staff mail delivery failed");
  if (result.status === "FAILED") {
    res.status(502).json({ data: { ...result, outboxId }, error: { code: "MAIL_DELIVERY_FAILED", providerCode: result.errorCode, message: `Die E-Mail wurde vom Mailanbieter abgelehnt (${result.errorCode}). Bitte Empfänger und Inhalt prüfen und erneut senden.` } });
    return;
  }
  res.status(202).json({ data: { ...result, outboxId } });
}

export function mailNotConfigured(res: Response): void {
  res.status(503).json({ error: { code: "MAIL_NOT_CONFIGURED", message: "Der E-Mail-Versand ist noch nicht eingerichtet." } });
}

export function invalidEmail(res: Response, issues: Array<{ field: string; message: string }>): void {
  res.status(400).json({ error: { code: "INVALID_EMAIL", message: issues.map((issue) => issue.message).join(" · "), issues } });
}
