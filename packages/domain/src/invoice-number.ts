export const MAX_INVOICE_SEQUENCE_VALUE = 2_147_483_647;

export function manualInvoiceNextValue(invoiceNumber: string | undefined): number | undefined {
  const match = /^R-(\d+)$/u.exec(invoiceNumber ?? "");
  if (!match) return undefined;
  const number = Number(match[1]);
  return number > 0 ? number + 1 : undefined;
}
