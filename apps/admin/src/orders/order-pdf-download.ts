export interface OrderPdfFile { blob: Blob; filename: string }

export async function saveAndFetchOrderPdf(orderNumber: number, save: () => Promise<boolean>): Promise<OrderPdfFile | null> {
  if (!await save()) return null;
  const response = await fetch(`/api/admin/orders/${orderNumber}/pdf`, { credentials: "same-origin" });
  if (!response.ok) {
    const body = await response.json() as { error?: { message?: string } };
    throw new Error(body.error?.message ?? "Das Auftrags-PDF konnte nicht erzeugt werden.");
  }
  if (!response.headers.get("Content-Type")?.startsWith("application/pdf")) {
    throw new Error("Der Server hat kein gültiges Auftrags-PDF geliefert.");
  }
  const encodedName = response.headers.get("Content-Disposition")?.match(/filename\*=UTF-8''([^;]+)/iu)?.[1];
  if (!encodedName) throw new Error("Der PDF-Dateiname fehlt in der Serverantwort.");
  const blob = await response.blob();
  if (await blob.slice(0, 4).text() !== "%PDF") throw new Error("Der Server hat kein gültiges Auftrags-PDF geliefert.");
  return { blob, filename: decodeURIComponent(encodedName) };
}

export function downloadOrderPdf(file: OrderPdfFile) {
  const url = URL.createObjectURL(file.blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
