import { randomUUID } from "node:crypto";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import { recordMailSent, recoverStaleMailClaims } from "./mail-outbox-service.js";

export interface MailReconciliation {
  outboxId: string;
  actorName: string;
  evidenceRef: string;
  workersStopped: true;
  resolution: { status: "SENT"; sentFolderUid: number; sentAt: Date } | { status: "NOT_SENT"; providerConfirmedNotSent: true };
}

/**
 * Operator-only recovery, never an automatic inference from a missing Sent copy.
 * SENT means provider submission, not receipt by the customer. The operator must
 * verify the original INBOX.Sent message or obtain provider confirmation.
 */
export async function reconcileOutboxMail(input: MailReconciliation): Promise<{ status: "SENT" | "PENDING"; auditId: string }> {
  if (input.workersStopped !== true || !input.actorName.trim() || input.actorName.length > 191 ||
      !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/u.test(input.evidenceRef)) {
    throw new Error("INVALID_MAIL_RECONCILIATION");
  }
  if (input.resolution.status === "SENT") {
    if (!Number.isSafeInteger(input.resolution.sentFolderUid) || input.resolution.sentFolderUid < 1 ||
        !Number.isFinite(input.resolution.sentAt.getTime()) || input.resolution.sentAt > new Date()) {
      throw new Error("INVALID_MAIL_RECONCILIATION");
    }
  } else if (input.resolution.providerConfirmedNotSent !== true) {
    throw new Error("MAIL_NOT_SENT_CONFIRMATION_REQUIRED");
  }
  await recoverStaleMailClaims(new Date(), input.outboxId);
  return prisma.$transaction(async (tx) => {
    const row = await tx.emailOutbox.findUniqueOrThrow({ where: { id: input.outboxId } });
    if (row.status !== "UNKNOWN") throw new Error("MAIL_RECONCILIATION_REQUIRES_UNKNOWN");
    const guard = { status: "UNKNOWN", attempts: row.attempts, lockedAt: row.lockedAt };
    const status = input.resolution.status === "SENT" ? "SENT" : "PENDING";
    if (input.resolution.status === "SENT") {
      await recordMailSent(tx, row, input.resolution.sentAt, guard, "MAIL_RECONCILED_SENT");
    } else {
      const updated = await tx.emailOutbox.updateMany({
        where: { id: row.id, ...guard },
        data: { status: "PENDING", lockedAt: null, nextAttemptAt: new Date(), lastErrorCode: "MAIL_RECONCILED_NOT_SENT" },
      });
      if (updated.count !== 1) throw new Error("MAIL_RECONCILIATION_CONFLICT");
    }
    // A terminal, non-deliverable outbox record preserves recovery evidence
    // without inventing a successful EmailEvent for a NOT_SENT decision.
    const auditId = randomUUID();
    await tx.emailOutbox.create({
      data: {
        id: auditId,
        orderId: row.orderId,
        kind: "MAIL_RECONCILIATION",
        status: "RESOLVED",
        recipients: [],
        subject: "MAIL_RECONCILIATION",
        contentHtml: JSON.stringify({
          outboxId: row.id, attempt: row.attempts, resolution: input.resolution.status,
          evidenceRef: input.evidenceRef,
          ...(input.resolution.status === "SENT" ? { folder: "INBOX.Sent", uid: input.resolution.sentFolderUid, sentAt: input.resolution.sentAt.toISOString() } : {}),
        }),
        actorName: input.actorName.trim(),
        idempotencyKey: `reconciliation:${auditId}`,
        nextAttemptAt: new Date(),
        attachments: Prisma.DbNull,
      },
    });
    return { status, auditId };
  });
}

export async function inspectUncertainMail(limit = 25): Promise<Array<{ id: string; status: string; attempts: number; lastErrorCode: string | null; lockedAt: Date | null }>> {
  await recoverStaleMailClaims();
  return prisma.emailOutbox.findMany({
    where: { status: { in: ["UNKNOWN", "SENDING"] } },
    select: { id: true, status: true, attempts: true, lastErrorCode: true, lockedAt: true },
    orderBy: { createdAt: "asc" },
    take: Math.min(Math.max(Math.floor(limit) || 25, 1), 200),
  });
}
