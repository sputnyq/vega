import "dotenv/config";

try {
  const { loadConfig } = await import("./config.js");
  const { createConfiguredMailService } = await import("./mail/configured-mail-service.js");
  const { resolveMaintenanceLimit, runMailMaintenance } = await import("./mail/mail-maintenance.js");

  const config = loadConfig();
  const mailService = createConfiguredMailService(config);
  if (!mailService) {
    console.error("Mail maintenance skipped: mail transport is not configured.");
    process.exitCode = 1;
  } else {
    const limit = resolveMaintenanceLimit(process.env.MAIL_MAINTENANCE_LIMIT);
    const result = await runMailMaintenance(mailService, limit);
    // Only counts are logged: never recipients, content, tokens, or provider bodies.
    console.info(JSON.stringify({ event: "mail-maintenance", sent: result.sent, failed: result.failed, limit }));
    process.exitCode = 0;
  }
} catch (error) {
  console.error(JSON.stringify({ event: "mail-maintenance-failed", code: error instanceof Error ? error.message : "MAINTENANCE_FAILED" }));
  process.exitCode = 1;
}
