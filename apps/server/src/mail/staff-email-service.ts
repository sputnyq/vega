import type { Request, Response } from "express";
import { isValidEmailAddress } from "@vega/domain";
import { prisma } from "../prisma.js";
import { htmlToPlainText, sanitizeEmailHtml } from "./email-template.js";
import { MailDeliveryError } from "./hostinger-mail-client.js";
import { deliverOutboxMail, queueMail, type QueueMailInput } from "./mail-outbox-service.js";
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

export type StaffSendResult =
  | { status: "SENT" }
  | { status: "SENDING" }
  | { status: "RETRY_SCHEDULED"; errorCode: string }
  | { status: "FAILED"; errorCode: string };

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
    const deliveryError = error instanceof MailDeliveryError ? error : new MailDeliveryError("MAIL_SEND_FAILED", true);
    return { outboxId, result: deliveryError.retryable
      ? { status: "RETRY_SCHEDULED", errorCode: deliveryError.code }
      : { status: "FAILED", errorCode: deliveryError.code } };
  }
  const row = await prisma.emailOutbox.findUniqueOrThrow({ where: { id: outboxId }, select: { status: true, lastErrorCode: true } });
  if (row.status === "SENT") return { outboxId, result: { status: "SENT" } };
  if (row.status === "SENDING" || row.status === "PENDING") return { outboxId, result: { status: "SENDING" } };
  return { outboxId, result: { status: "RETRY_SCHEDULED", errorCode: row.lastErrorCode ?? "MAIL_SEND_FAILED" } };
}

export function respondWithSendResult(req: Request, res: Response, outboxId: string, result: StaffSendResult): void {
  res.setHeader("Cache-Control", "no-store");
  if (result.status === "SENT") {
    res.json({ data: result });
    return;
  }
  // Only the outbox id and machine code are logged, never recipients or content.
  if ("errorCode" in result) req.log.warn({ outboxId, code: result.errorCode }, "staff mail delivery failed");
  if (result.status === "FAILED") {
    res.status(502).json({ error: { code: "MAIL_DELIVERY_FAILED", providerCode: result.errorCode, message: `Die E-Mail wurde vom Mailanbieter abgelehnt (${result.errorCode}). Bitte Empfänger und Inhalt prüfen und erneut senden.` } });
    return;
  }
  res.status(202).json({ data: result });
}

export function mailNotConfigured(res: Response): void {
  res.status(503).json({ error: { code: "MAIL_NOT_CONFIGURED", message: "Der E-Mail-Versand ist noch nicht eingerichtet." } });
}

export function invalidEmail(res: Response, issues: Array<{ field: string; message: string }>): void {
  res.status(400).json({ error: { code: "INVALID_EMAIL", message: issues.map((issue) => issue.message).join(" · "), issues } });
}
