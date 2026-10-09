import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import { APIError } from "better-auth/api";
import type { createAuth } from "../auth-config.js";
import type { AppConfig } from "../config.js";
import { prisma } from "../prisma.js";
import { consumePublicApiRateLimit } from "../public-rate-limit.js";
import { record, validateStaffAction, validateStaffCreate } from "./staff-input.js";
import { changeStaff, createStaff, StaffError, staffResetTarget, staffSelect } from "./staff-service.js";

export function createStaffRouter(auth: ReturnType<typeof createAuth>, config: AppConfig) {
  const router = Router();
  router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
  router.get("/", async (req, res, next) => {
    try {
      const page = typeof req.query.page === "string" && /^\d{1,6}$/u.test(req.query.page) ? Math.max(1, Number(req.query.page)) : 1;
      const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 191) : "";
      const where: import("@prisma/client").Prisma.UserWhereInput = search ? { OR: [{ name: { contains: search } }, { email: { contains: search } }] } : {};
      const [total, items] = await prisma.$transaction([
        prisma.user.count({ where }),
        prisma.user.findMany({ where, select: staffSelect, orderBy: [{ name: "asc" }, { id: "asc" }], take: 25, skip: (page - 1) * 25 }),
      ]);
      res.json({ data: { items, total, page, pageSize: 25 } });
    } catch (error) { next(error); }
  });
  router.use(async (req, res, next) => {
    try {
      if (req.headers.origin && !config.betterAuthTrustedOrigins.includes(req.headers.origin)) {
        throw new StaffError(403, "INVALID_ORIGIN", "Ungültige Anfrage-Origin.");
      }
      if (!await consumePublicApiRateLimit(String(res.locals.staffUser.id), config.betterAuthSecret, "staff-password-confirmation", 5)) {
        res.setHeader("Retry-After", "60");
        throw new StaffError(429, "RATE_LIMITED", "Zu viele Bestätigungen. Bitte warten Sie eine Minute.");
      }
      if (!record(req.body) || typeof req.body.currentPassword !== "string" || !req.body.currentPassword || req.body.currentPassword.length > 128) {
        throw new StaffError(400, "PASSWORD_CONFIRMATION_REQUIRED", "Bitte bestätigen Sie die Aktion mit Ihrem aktuellen Admin-Passwort.");
      }
      try { await auth.api.verifyPassword({ body: { password: req.body.currentPassword }, headers: fromNodeHeaders(req.headers) }); }
      catch (error) {
        if (!(error instanceof APIError)) throw error;
        if (error.statusCode >= 500) throw error;
        throw new StaffError(403, "PASSWORD_CONFIRMATION_FAILED", "Das aktuelle Admin-Passwort ist nicht korrekt.");
      }
      next();
    } catch (error) { next(error); }
  });
  router.post("/", async (req, res, next) => {
    try {
      const input = validateStaffCreate(req.body);
      if (!input) throw new StaffError(400, "INVALID_STAFF", "Bitte prüfen Sie Name, E-Mail, Rolle und Initialpasswort (8–128 Zeichen, Groß-/Kleinbuchstabe und Zahl).");
      res.status(201).json({ data: await createStaff(String(res.locals.staffUser.id), input) });
    } catch (error) {
      if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") next(new StaffError(409, "EMAIL_IN_USE", "Diese E-Mail-Adresse wird bereits verwendet."));
      else next(error);
    }
  });
  router.post("/:id/actions", async (req, res, next) => {
    try {
      const action = validateStaffAction(req.body);
      if (!action) throw new StaffError(400, "INVALID_STAFF_ACTION", "Ungültige Kontoaktion.");
      if (action.kind !== "reset-password") {
        res.json({ data: await changeStaff(String(res.locals.staffUser.id), req.params.id, action) });
        return;
      }
      const target = await staffResetTarget(String(res.locals.staffUser.id), req.params.id);
      if (!config.mail) throw new StaffError(503, "MAIL_NOT_CONFIGURED", "Der Hostinger-Mailversand ist noch nicht eingerichtet.");
      try {
        await auth.requestStaffPasswordReset({ email: target.email, redirectTo: new URL("/reset-password", config.appBaseUrl).href });
      } catch {
        req.log.warn({ code: "STAFF_RESET_MAIL_FAILED" }, "staff password reset mail failed");
        throw new StaffError(502, "STAFF_RESET_MAIL_FAILED", "Die Reset-Mail konnte nicht versendet werden. Bitte versuchen Sie es erneut.");
      }
      res.json({ data: { sent: true } });
    } catch (error) { next(error); }
  });
  router.use(((error, _req, res, next) => {
    if (error instanceof StaffError) res.status(error.status).json({ error: { code: error.code, message: error.message } });
    else next(error);
  }) satisfies import("express").ErrorRequestHandler);
  return router;
}
