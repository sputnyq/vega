import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import cors from "cors";
import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import type { AppConfig } from "./config.js";

const adminBuild = fileURLToPath(new URL("../../admin/dist", import.meta.url));
const customerFormBuild = fileURLToPath(new URL("../../customer-form/dist", import.meta.url));

export function createApp(config: AppConfig) {
  const app = express();
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
    origin(origin, callback) {
      // Requests without an Origin (e.g. health probes) are not browser CORS requests.
      callback(null, origin === undefined || config.corsAllowedOrigins.includes(origin));
    },
  }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ status: "ok", service: "vega" });
  });

  app.get("/", (_req, res) => res.redirect(302, "/admin/"));
  app.use("/admin", express.static(adminBuild, { index: false, fallthrough: true }));
  app.get(/^\/admin(?:\/.*)?$/, (_req, res, next) => {
    if (!existsSync(`${adminBuild}/index.html`)) return next();
    return res.sendFile(`${adminBuild}/index.html`);
  });
  app.use("/customer-form", express.static(customerFormBuild, { index: false, fallthrough: true }));
  app.get(/^\/customer-form(?:\/.*)?$/, (_req, res, next) => {
    if (!existsSync(`${customerFormBuild}/index.html`)) return next();
    return res.sendFile(`${customerFormBuild}/index.html`);
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
