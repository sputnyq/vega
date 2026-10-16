import "dotenv/config";
import { prisma } from "../prisma.js";
import { inspectUncertainMail, reconcileOutboxMail } from "./mail-reconciliation.js";

try {
  const args = process.argv.slice(2);
  const workersStopped = args.includes("--workers-stopped");
  const [command, outboxId, decision, actorName, evidenceRef, proof, sentAt] = args.filter((arg) => arg !== "--workers-stopped");
  if (command === "inspect") {
    console.info(JSON.stringify({ event: "mail-reconciliation-inspect", items: await inspectUncertainMail() }));
  } else if (command === "resolve" && outboxId && actorName && evidenceRef && workersStopped) {
    const resolution = decision === "sent"
      ? { status: "SENT" as const, sentFolderUid: Number(proof), sentAt: new Date(sentAt ?? "") }
      : decision === "not-sent" && proof === "--provider-confirmed-not-sent"
        ? { status: "NOT_SENT" as const, providerConfirmedNotSent: true as const } : undefined;
    if (!resolution) throw new Error("INVALID_MAIL_RECONCILIATION");
    const result = await reconcileOutboxMail({ outboxId, actorName, evidenceRef, workersStopped: true, resolution });
    console.info(JSON.stringify({ event: "mail-reconciliation-resolved", outboxId, ...result }));
  } else {
    throw new Error("MAIL_RECONCILIATION_USAGE");
  }
} catch (error) {
  // Never print raw DB/provider errors, arguments, or mail contents.
  const safeCodes = ["INVALID_MAIL_RECONCILIATION", "MAIL_NOT_SENT_CONFIRMATION_REQUIRED", "MAIL_RECONCILIATION_REQUIRES_UNKNOWN", "MAIL_RECONCILIATION_CONFLICT", "MAIL_RECONCILIATION_USAGE"];
  const code = error instanceof Error && safeCodes.includes(error.message) ? error.message : "MAIL_RECONCILIATION_FAILED";
  console.error(JSON.stringify({ event: "mail-reconciliation-failed", code }));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
