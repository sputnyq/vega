import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { MailDeliveryError, type MailAttachment } from "./hostinger-mail-client.js";
import type { EmailKind, MailService } from "./mail-service.js";

export interface QueueMailInput {
  orderId?: string;
  kind: Exclude<EmailKind, "PASSWORD_RESET">;
  to: string[];
  subject: string;
  contentHtml: string;
  attachments?: MailAttachment[];
  actorName?: string;
  idempotencyKey: string;
}

/** Stores mail before delivery. It deliberately contains no password-reset token. */
export async function queueMail(input: QueueMailInput): Promise<string> {
  const id = randomUUID();
  const row = await prisma.emailOutbox.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    create: {
      id,
      ...(input.orderId ? { orderId: input.orderId } : {}),
      kind: input.kind,
      recipients: input.to as Prisma.InputJsonValue,
      subject: input.subject,
      contentHtml: input.contentHtml,
      ...(input.attachments ? { attachments: input.attachments as unknown as Prisma.InputJsonValue } : {}),
      ...(input.actorName ? { actorName: input.actorName } : {}),
      idempotencyKey: input.idempotencyKey,
      nextAttemptAt: new Date(),
    },
    update: {},
    select: { id: true },
  });
  return row.id;
}

export async function deliverOutboxMail(id: string, mailService: MailService): Promise<"sent" | "not-claimed"> {
  const claimed = await prisma.emailOutbox.updateMany({
    where: { id, status: { in: ["PENDING", "FAILED"] }, nextAttemptAt: { lte: new Date() } },
    data: { status: "SENDING", lockedAt: new Date(), attempts: { increment: 1 }, lastErrorCode: null },
  });
  if (claimed.count !== 1) return "not-claimed";

  const row = await prisma.emailOutbox.findUniqueOrThrow({ where: { id } });
  try {
    const mailInput = {
      kind: row.kind as EmailKind,
      to: parseRecipients(row.recipients),
      subject: row.subject,
      contentHtml: row.contentHtml,
    };
    if (row.attachments) {
      await mailService.send({ ...mailInput, attachments: parseAttachments(row.attachments) });
    } else {
      await mailService.send(mailInput);
    }
    const sentAt = new Date();
    await prisma.$transaction([
      prisma.emailOutbox.update({ where: { id }, data: { status: "SENT", sentAt, lockedAt: null, lastErrorCode: null } }),
      prisma.emailEvent.create({ data: { id: randomUUID(), outboxId: id, orderId: row.orderId, kind: row.kind, actorName: row.actorName, sentAt } }),
    ]);
    return "sent";
  } catch (error) {
    const deliveryError = error instanceof MailDeliveryError ? error : new MailDeliveryError("MAIL_SEND_FAILED", true);
    await prisma.emailOutbox.update({
      where: { id },
      data: {
        status: "FAILED",
        lockedAt: null,
        lastErrorCode: deliveryError.code,
        nextAttemptAt: nextRetryAt(row.attempts + 1, deliveryError.retryable),
      },
    });
    throw deliveryError;
  }
}

/** Called by the authenticated internal daily maintenance task; never expose as a public route. */
export async function deliverDueOutboxMail(mailService: MailService, limit = 25): Promise<{ sent: number; failed: number }> {
  const due = await prisma.emailOutbox.findMany({
    where: { status: { in: ["PENDING", "FAILED"] }, nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: "asc" },
    take: limit,
    select: { id: true },
  });
  let sent = 0;
  let failed = 0;
  for (const { id } of due) {
    try {
      if (await deliverOutboxMail(id, mailService) === "sent") sent += 1;
    } catch {
      failed += 1;
    }
  }
  return { sent, failed };
}

function parseRecipients(value: Prisma.JsonValue): string[] {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) throw new Error("INVALID_OUTBOX_RECIPIENTS");
  return value as unknown as string[];
}

function parseAttachments(value: Exclude<Prisma.JsonValue, null>): MailAttachment[] {
  if (!Array.isArray(value)) throw new Error("INVALID_OUTBOX_ATTACHMENTS");
  return value as unknown as MailAttachment[];
}

function nextRetryAt(attempt: number, retryable: boolean): Date {
  // Permanent provider failures remain visible for manual correction; they are not retried automatically.
  const delayMs = retryable ? Math.min(60_000 * 2 ** Math.min(attempt - 1, 8), 24 * 60 * 60 * 1000) : 365 * 24 * 60 * 60 * 1000;
  return new Date(Date.now() + delayMs);
}
