import { Buffer } from "node:buffer";
import PDFDocument from "pdfkit";
import { LEGACY_RZ24_LOGO } from "./legacy-logo.js";

/** Shared PDFKit layout of the legacy accounting documents (invoice, credit note, reminder). */
export const PAGE = { left: 56.7, right: 595.28 - 34, width: 595.28 - 34 - 56.7 };

export interface InvoiceEntry { description: string; quantity: number; unitPrice: number }

export function startAccountingPdf(title: string, information: string[], customer: string[]) {
  const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: title } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  const logo = Buffer.from(LEGACY_RZ24_LOGO.slice(LEGACY_RZ24_LOGO.indexOf(",") + 1), "base64");
  doc.image(logo, PAGE.left, 22.7, { width: 96, height: 102 });
  drawRight(doc, ["Alexander Berent", "Am Münchfeld 31, 80999 München", "089 30642972 | 0176 10171990", "info@umzugruckzuck24.de", "Steuernummer: 144/139/21180"], 37.1, 8);
  // Match the supplied reference PDF's postal block after the legacy header flow.
  let y = (8 + 5 + 15) / 0.353 + 5 * 12 + 3 * 6 - 6;
  // jsPDF uses baselines; PDFKit positions Helvetica text at the top (ascender 718/1000).
  text(doc, "Alexander Berent, Am Münchfeld 31, 80999 München", PAGE.left, y + 9.2 - 5.744, 8);
  y += 18.4 + 5 / 0.353;
  information.forEach((line) => { drawRight(doc, [line], y + 7 - 7.18, 10); y += 14; });
  y += 5 / 0.353;
  const customerY = y;
  customer.filter(Boolean).forEach((line, index) => { text(doc, line, PAGE.left, customerY + index * 14 + 7 - 7.18, 10); });
  return { doc, done };
}

export function drawHeading(doc: PDFKit.PDFDocument, value: string, y: number, size = 12) {
  doc.font("Helvetica-Bold").fontSize(size).fillColor("black").text(value, PAGE.left, y, { width: PAGE.width, align: "center" });
}

export function drawEntriesTable(doc: PDFKit.PDFDocument, entries: InvoiceEntry[], y: number, sign: 1 | -1 = 1): number {
  const columns = [PAGE.left, 315, 393, 475, PAGE.right];
  return drawTable(doc, ["Bezeichnung", "Menge", "Einzelpreis", "Betrag"], entries.map((entry) => [entry.description, formatNumber(entry.quantity), euro(sign * entry.unitPrice), euro(sign * entry.quantity * entry.unitPrice)]), columns, y, ["left", "right", "right", "right"]);
}

export function drawTable(doc: PDFKit.PDFDocument, head: string[], rows: string[][], columns: number[], y: number, align: Array<"left" | "right" | "center">, color = "black"): number {
  const headerHeight = 14.4;
  const left = columns[0]!; const right = columns[columns.length - 1]!;
  doc.fillColor("#6987a3").rect(left, y, right - left, headerHeight).fill(); doc.fillColor("white").font("Helvetica").fontSize(9);
  head.forEach((label, i) => doc.text(label, columns[i]! + 4, y + 5, { width: columns[i + 1]! - columns[i]! - 8, align: align[i] ?? "left" })); y += headerHeight;
  for (const row of rows) {
    const rowHeight = Math.max(14.4, doc.heightOfString(row[0] ?? "", { width: columns[1]! - columns[0]! - 8 }) + 4);
    doc.strokeColor("#6987a3").rect(left, y, right - left, rowHeight).stroke();
    doc.fillColor(color);
    row.forEach((value, i) => doc.text(value, columns[i]! + 4, y + 5, { width: columns[i + 1]! - columns[i]! - 8, align: align[i] ?? "left" }));
    y += rowHeight;
  }
  doc.fillColor("black");
  return y;
}

/** Draws the free text and returns the y position below it. */
export function drawText(doc: PDFKit.PDFDocument, value: string, y: number): number {
  if (!value) return y;
  text(doc, value, PAGE.left, y, 10, PAGE.width);
  return y + Math.max(20, doc.heightOfString(value, { width: PAGE.width }));
}

export function drawBankFooter(doc: PDFKit.PDFDocument, y: number, note?: string) {
  if (note) { text(doc, note, PAGE.left, y, 8); y += 13.2; }
  doc.strokeColor("#969696").moveTo(PAGE.left, y).lineTo(PAGE.right, y).stroke(); y += 8;
  text(doc, "Bankverbindung:", PAGE.left, y, 8);
  ["Alexander Berent, Stadtsparkasse München", "IBAN: DE41 7015 0000 1005 7863 20", "BIC: SSKMDEMMXXX"].forEach((line, index) => drawRight(doc, [line], y + index * 14, 8));
}

export function drawRight(doc: PDFKit.PDFDocument, lines: string[], y: number, size: number) {
  lines.forEach((line, index) => doc.font("Helvetica").fontSize(size).fillColor("#3c3c3c").text(line, 0, y + index * (size + 4), { width: PAGE.right, align: "right" }));
  doc.fillColor("black");
}

export function calculateInvoiceTotals(entries: Array<{ quantity: number; unitPrice: number }>, taxPercent: number) {
  const net = entries.reduce((sum, entry) => sum + entry.quantity * entry.unitPrice, 0);
  const tax = net * taxPercent / 100;
  return { net, tax, total: net + tax };
}

export function parseEntries(value: unknown): InvoiceEntry[] {
  return Array.isArray(value) ? value.filter((entry): entry is InvoiceEntry => typeof entry === "object" && entry !== null && typeof (entry as Record<string, unknown>).description === "string" && typeof (entry as Record<string, unknown>).quantity === "number" && typeof (entry as Record<string, unknown>).unitPrice === "number") : [];
}

/** Customer part of accounting file names: company or name without salutation, filesystem-safe. */
export function filenameName(company: string, customerName: string, fallback: string): string {
  return (company || customerName).replace(/[^\p{L}\p{N} ._-]/gu, "").replace(/^(Herr|Frau)\s+/u, "").trim() || fallback;
}

export function formatDate(date: Date): string { return date.toLocaleDateString("de-DE", { timeZone: "Europe/Berlin" }); }
export function euro(value: number): string { return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value); }
export function formatNumber(value: number): string { return new Intl.NumberFormat("de-DE").format(value); }
function text(doc: PDFKit.PDFDocument, value: string, x: number, y: number, size: number, width?: number) { doc.font("Helvetica").fontSize(size).fillColor("black").text(value, x, y, width ? { width } : {}); }
