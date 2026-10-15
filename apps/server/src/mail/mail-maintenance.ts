import { deliverDueOutboxMail } from "./mail-outbox-service.js";
import type { MailService } from "./mail-service.js";

export const MAIL_MAINTENANCE_DEFAULT_LIMIT = 25;
export const MAIL_MAINTENANCE_MAX_LIMIT = 200;

export function resolveMaintenanceLimit(raw: string | undefined): number {
  const parsed = raw === undefined ? Number.NaN : Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) return MAIL_MAINTENANCE_DEFAULT_LIMIT;
  return Math.min(parsed, MAIL_MAINTENANCE_MAX_LIMIT);
}

export async function runMailMaintenance(
  mailService: MailService,
  limit: number = MAIL_MAINTENANCE_DEFAULT_LIMIT,
  deliver: (service: MailService, capped: number) => Promise<{ sent: number; failed: number }> = deliverDueOutboxMail,
): Promise<{ sent: number; failed: number }> {
  const capped = Number.isInteger(limit) && limit >= 1
    ? Math.min(limit, MAIL_MAINTENANCE_MAX_LIMIT)
    : MAIL_MAINTENANCE_DEFAULT_LIMIT;
  return deliver(mailService, capped);
}
