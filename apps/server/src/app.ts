import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { createAuth } from "./auth-config.js";
import { requireCompletedStaff } from "./auth-middleware.js";
import type { AppConfig } from "./config.js";
import { prisma } from "./prisma.js";
import { meetsPasswordPolicy, PASSWORD_POLICY_MESSAGE } from "./password-policy.js";
import { createOrderRouter } from "./orders/order-routes.js";
import { createCatalogRouter } from "./catalog/catalog-routes.js";

const adminBuild = fileURLToPath(new URL("../../admin/dist", import.meta.url));
const customerFormBuild = fileURLToPath(new URL("../../customer-form/dist", import.meta.url));

export function createApp(config: AppConfig) {
  const app = express();
  const auth = createAuth(config);
  app.disable("x-powered-by");

  app.use((req, res, next) => {
    const requestId = randomUUID();
    res.setHeader("X-Request-ID", requestId);
    res.locals.requestId = requestId;
    next();
  });
  app.use(pinoHttp({
    customProps: (_req, res) => ({ requestId: res.locals.requestId }),
    genReqId: (_req, res) => String(res.locals.requestId),
    redact: ["req.headers.authorization", "req.headers.cookie"],
  }));
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "data:"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", "data:", "blob:"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  }));
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      // Requests without an Origin (e.g. health probes) are not browser CORS requests.
      callback(null, origin === undefined || config.corsAllowedOrigins.includes(origin));
    },
  }));

  // Better Auth must receive the unconsumed request stream before express.json().
  app.all("/api/auth/*splat", toNodeHandler(auth));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ status: "ok", service: "vega" });
  });

  app.get("/api/admin/session", async (req, res, next) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session) {
        res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Bitte melden Sie sich an." } });
        return;
      }

      res.setHeader("Cache-Control", "no-store");
      res.json({
        data: {
          user: {
            name: session.user.name,
            email: session.user.email,
            role: session.user.role,
            mustChangePassword: session.user.mustChangePassword,
            twoFactorEnabled: session.user.twoFactorEnabled,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.use(createOrderRouter(auth, config));
  app.use(createCatalogRouter(auth, config));

  app.post("/api/admin/auth/initial-password", async (req, res, next) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session) {
        res.status(401).json({ error: { code: "UNAUTHENTICATED", message: "Bitte melden Sie sich an." } });
        return;
      }
      if (!session.user.mustChangePassword) {
        res.status(409).json({ error: { code: "PASSWORD_CHANGE_NOT_REQUIRED", message: "Ein initialer Passwortwechsel ist nicht erforderlich." } });
        return;
      }

      const body = req.body as { currentPassword?: unknown; newPassword?: unknown };
      if (
        typeof body?.currentPassword !== "string" ||
        typeof body.newPassword !== "string" ||
        !meetsPasswordPolicy(body.newPassword) ||
        body.currentPassword === body.newPassword
      ) {
        res.status(400).json({ error: { code: "INVALID_PASSWORD", message: `${PASSWORD_POLICY_MESSAGE} Das neue Passwort muss sich außerdem vom Initialpasswort unterscheiden.` } });
        return;
      }

      try {
        await auth.api.changePassword({
          body: {
            currentPassword: body.currentPassword,
            newPassword: body.newPassword,
            revokeOtherSessions: false,
          },
          headers: fromNodeHeaders(req.headers),
        });
      } catch {
        res.status(400).json({ error: { code: "PASSWORD_CHANGE_FAILED", message: "Das Passwort konnte nicht geändert werden." } });
        return;
      }

      await prisma.user.update({
        where: { id: session.user.id },
        data: { mustChangePassword: false },
      });
      res.setHeader("Cache-Control", "no-store");
      res.json({ data: { passwordChanged: true } });
    } catch (error) {
      next(error);
    }
  });

  // Every future admin API is denied until the password and mandatory TOTP setup are complete.
  app.use("/api/admin", requireCompletedStaff(auth));

  app.use("/customer-form", express.static(customerFormBuild, { index: false, fallthrough: true }));
  app.get(/^\/customer-form\/?$/, (_req, res, next) => {
    if (!existsSync(`${customerFormBuild}/index.html`)) return next();
    return res.sendFile(`${customerFormBuild}/index.html`);
  });

  app.use(express.static(adminBuild, { index: false, fallthrough: true }));
  app.get("/", async (req, res, next) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session) {
        res.redirect(302, "/login");
        return;
      }
      if (!existsSync(`${adminBuild}/index.html`)) return next();
      res.sendFile(`${adminBuild}/index.html`);
    } catch (error) {
      next(error);
    }
  });
  app.get("/login", async (req, res, next) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (session) {
        res.redirect(302, "/");
        return;
      }
      if (!existsSync(`${adminBuild}/index.html`)) return next();
      res.sendFile(`${adminBuild}/index.html`);
    } catch (error) {
      next(error);
    }
  });
  app.get("/two-factor", (_req, res, next) => {
    if (!existsSync(`${adminBuild}/index.html`)) return next();
    res.sendFile(`${adminBuild}/index.html`);
  });
  app.get(/^\/admin\/?$/, (_req, res) => res.redirect(302, "/"));

  app.get(/^(?!\/api(?:\/|$))(?!\/health(?:\/|$))(?!\/customer-form(?:\/|$))(?!\/assets(?:\/|$)).*/, (req, res, next) => {
    if (!req.accepts("html") || !existsSync(`${adminBuild}/index.html`)) return next();
    res.status(404).sendFile(`${adminBuild}/index.html`);
  });

  app.use((_req, res) => {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Route nicht gefunden." } });
  });

  const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
    const requestId = String(res.locals.requestId ?? "unbekannt");
    req.log.error({ err: error, requestId }, "request failed");
    res.status(500).json({
      error: { code: "INTERNAL_SERVER_ERROR", message: "Interner Serverfehler.", requestId },
    });
  };
  app.use(errorHandler);

  return app;
}
