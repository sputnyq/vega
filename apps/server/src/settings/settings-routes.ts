import { Router } from "express";
import { prisma } from "../prisma.js";
import { validateInvoiceSequence, validateSettings } from "./settings-input.js";
import { getAppSettings, saveAppSettings } from "./settings-service.js";
import type { AppConfig } from "../config.js";

export function createSettingsRouter(config: AppConfig) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  router.use((req, res, next) => {
    if (req.method !== "GET" && req.headers.origin !== undefined && !config.betterAuthTrustedOrigins.includes(req.headers.origin)) {
      res.status(403).json({ error: { code: "INVALID_ORIGIN", message: "Ungültige Anfrage-Origin." } });
      return;
    }
    next();
  });
  router.get("/", async (_req, res, next) => {
    try { res.json({ data: await getAppSettings() }); } catch (error) { next(error); }
  });
  router.put("/", async (req, res, next) => {
    try {
      const validation = validateSettings(req.body);
      if (!validation.ok) return res.status(400).json({ error: { code: "INVALID_SETTINGS", message: "Bitte prüfen Sie die Einstellungen.", issues: validation.issues } });
      const settings = await saveAppSettings(validation.value);
      if (!settings) return res.status(409).json({ error: { code: "SETTINGS_CHANGED", message: "Die Einstellungen wurden inzwischen geändert. Laden Sie den aktuellen Stand, bevor Sie erneut speichern." } });
      return res.json({ data: settings });
    } catch (error) { next(error); }
  });
  router.get("/invoice-number", async (_req, res, next) => {
    try {
      const sequence = await prisma.invoiceNumberSequence.findUniqueOrThrow({ where: { id: 1 }, select: { nextValue: true } });
      res.json({ data: sequence });
    } catch (error) { next(error); }
  });
  router.put("/invoice-number", async (req, res, next) => {
    try {
      const sequence = validateInvoiceSequence(req.body);
      if (!sequence) {
        return res.status(400).json({ error: { code: "INVALID_INVOICE_SEQUENCE", message: "Bitte geben Sie eine positive ganze Rechnungsnummer ein." } });
      }
      const { nextValue, expectedNextValue } = sequence;
      const result = await prisma.$transaction(async (transaction) => {
        const invoices = await transaction.invoice.findMany({ where: { invoiceNumber: { startsWith: "R-" } }, select: { invoiceNumber: true } });
        if (invoices.some((invoice) => /^R-\d+$/u.test(invoice.invoiceNumber) && Number(invoice.invoiceNumber.slice(2)) >= nextValue)) return "used";
        const update = await transaction.invoiceNumberSequence.updateMany({
          where: { id: 1, nextValue: expectedNextValue }, data: { nextValue },
        });
        return update.count === 1 ? "saved" : "changed";
      });
      if (result !== "saved") return res.status(409).json({ error: {
        code: result === "used" ? "INVOICE_NUMBER_IN_USE" : "INVOICE_SEQUENCE_CHANGED",
        message: result === "used" ? "Der Nummernkreis muss nach den bereits vergebenen R-Rechnungsnummern fortgesetzt werden." : "Der Nummernkreis wurde inzwischen verwendet oder geändert. Bitte laden Sie ihn erneut.",
      } });
      return res.json({ data: { nextValue } });
    } catch (error) { next(error); }
  });
  return router;
}
