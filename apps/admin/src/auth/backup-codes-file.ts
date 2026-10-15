export const BACKUP_CODES_FILE_NAME = "vega-wiederherstellungscodes.txt";

export function formatBackupCodesFile(backupCodes: readonly string[], createdAt: Date = new Date()): string {
  return [
    "Vega – Wiederherstellungscodes",
    `Erstellt: ${createdAt.toISOString()}`,
    "",
    "Jeder Code kann genau einmal verwendet werden.",
    "Bewahren Sie diese Datei sicher und getrennt vom Authenticator-Gerät auf.",
    "",
    ...backupCodes,
    "",
  ].join("\n");
}

export function downloadBackupCodesFile(backupCodes: readonly string[]): void {
  const blob = new Blob([formatBackupCodesFile(backupCodes)], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = BACKUP_CODES_FILE_NAME;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
