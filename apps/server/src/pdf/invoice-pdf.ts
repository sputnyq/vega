import { Buffer } from "node:buffer";
import PDFDocument from "pdfkit";
import type { Invoice } from "@prisma/client";
import { LEGACY_RZ24_LOGO } from "./legacy-logo.js";

/** Server-side rendering of the established legacy InvoicePdf layout. */
export async function generateInvoicePdf(invoice: Invoice): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 0, info: { Title: `Rechnung ${invoice.invoiceNumber}` } });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const done = new Promise<Buffer>((resolve, reject) => { doc.on("end", () => resolve(Buffer.concat(chunks))); doc.on("error", reject); });
  const left = 56.7; const right = 34; const width = 595.28; let y = 22.7;
  const logo = Buffer.from(LEGACY_RZ24_LOGO.slice(LEGACY_RZ24_LOGO.indexOf(",") + 1), "base64");
  doc.image(logo, left, y, { width: 96, height: 102 });
  drawRight(doc, ["Alexander Berent", "Am Münchfeld 31, 80999 München", "089 30642972 | 0176 10171990", "info@umzugruckzuck24.de", "", "Steuernummer: 144/139/21180"], y + 3, 8, width - right);
  y += 56;
  text(doc, "Alexander Berent, Am Münchfeld 31, 80999 München", left, y, 8); y += 18;
  drawRight(doc, [`Rechnungsdatum: ${formatDate(invoice.invoiceDate)}`, ...(invoice.orderNumberSnapshot ? [`Auftragsnummer: ${invoice.orderNumberSnapshot}`] : [])], y, 10, width - right); y += 30;
  [invoice.company, invoice.customerNameSnapshot, invoice.customerStreet, invoice.customerPostalCity].filter(Boolean).forEach((line) => { text(doc, line, left, y, 10); y += 14; });
  y += 95;
  doc.font("Helvetica-Bold").fontSize(12).fillColor("black").text(`Rechnung Nr: ${invoice.invoiceNumber}`, left, y, { width: width - left - right, align: "center" }); y += 35;
  const entries = parseEntries(invoice.entries);
  y = table(doc, entries, y, left, width - right);
  y += 28;
  const totals = calculateInvoiceTotals(entries, Number(invoice.taxPercent));
  drawRight(doc, [`Nettobetrag:   ${euro(totals.net)}`, `${formatNumber(Number(invoice.taxPercent))}% MwSt:     ${euro(totals.tax)}`, `Gesamtbetrag:   ${euro(totals.total)}`], y, 10, width - right); y += 55;
  if (invoice.text) { text(doc, invoice.text, left, y, 10, width - left - right); y += Math.max(20, doc.heightOfString(invoice.text, { width: width - left - right })); }
  y = Math.max(y, 708.7);
  text(doc, "Die Rechnung wurde maschinell erstellt und ist ohne Unterschrift gültig.", left, y, 8); y += 18;
  doc.strokeColor("#969696").moveTo(left, y).lineTo(width - right, y).stroke(); y += 8;
  text(doc, "Bankverbindung:", left, y, 8); drawRight(doc, ["Alexander Berent, Stadtsparkasse München", "IBAN: DE41 7015 0000 1005 7863 20", "BIC: SSKMDEMMXXX"], y, 8, width - right);
  doc.end(); return done;
}

export function calculateInvoiceTotals(entries: Array<{ quantity: number; unitPrice: number }>, taxPercent: number) {
  const net = entries.reduce((sum, entry) => sum + entry.quantity * entry.unitPrice, 0);
  const tax = net * taxPercent / 100;
  return { net, tax, total: net + tax };
}

export function invoicePdfFilename(invoice: Invoice): string { const name = (invoice.company || invoice.customerNameSnapshot).replace(/[^\p{L}\p{N} ._-]/gu, "").replace(/^(Herr|Frau)\s+/u, "").trim() || "Rechnung"; return `R-${invoice.invoiceNumber} ${name}.pdf`; }
function table(doc: PDFKit.PDFDocument, entries: Array<{ description: string; quantity: number; unitPrice: number }>, y: number, left: number, right: number): number {
  const columns = [left, 315, 393, 475, right]; const headerHeight = 18;
  doc.fillColor("#6987a3").rect(left, y, right - left, headerHeight).fill(); doc.fillColor("white").font("Helvetica").fontSize(9);
  ["Bezeichnung", "Menge", "Einzelpreis", "Betrag"].forEach((label, i) => doc.text(label, columns[i]! + 4, y + 5, { width: columns[i + 1]! - columns[i]! - 8, align: i === 0 ? "left" : "right" })); y += headerHeight;
  doc.fillColor("black");
  for (const entry of entries) { const rowHeight = Math.max(18, doc.heightOfString(entry.description, { width: columns[1]! - columns[0]! - 8 }) + 8); doc.strokeColor("#6987a3").rect(left, y, right - left, rowHeight).stroke(); [entry.description, formatNumber(entry.quantity), euro(entry.unitPrice), euro(entry.quantity * entry.unitPrice)].forEach((value, i) => doc.text(value, columns[i]! + 4, y + 4, { width: columns[i + 1]! - columns[i]! - 8, align: i === 0 ? "left" : "right" })); y += rowHeight; }
  return y;
}
function text(doc: PDFKit.PDFDocument, value: string, x: number, y: number, size: number, width?: number) { doc.font("Helvetica").fontSize(size).fillColor("black").text(value, x, y, width ? { width } : {}); }
function drawRight(doc: PDFKit.PDFDocument, lines: string[], y: number, size: number, right: number) { lines.forEach((line, index) => doc.font("Helvetica").fontSize(size).fillColor("#3c3c3c").text(line, 0, y + index * (size + 4), { width: right, align: "right" })); doc.fillColor("black"); }
function parseEntries(value: unknown): Array<{ description: string; quantity: number; unitPrice: number }> { return Array.isArray(value) ? value.filter((entry): entry is { description: string; quantity: number; unitPrice: number } => typeof entry === "object" && entry !== null && typeof (entry as Record<string, unknown>).description === "string" && typeof (entry as Record<string, unknown>).quantity === "number" && typeof (entry as Record<string, unknown>).unitPrice === "number") : []; }
function formatDate(date: Date): string { return date.toLocaleDateString("de-DE"); }
function euro(value: number): string { return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value); }
function formatNumber(value: number): string { return new Intl.NumberFormat("de-DE").format(value); }
