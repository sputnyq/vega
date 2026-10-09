import { Router } from "express";
import type { AppConfig } from "../config.js";
import { consumePublicApiRateLimit } from "../public-rate-limit.js";
import { createUploadService, UploadError, validateUploadRequest } from "./upload-service.js";

export function createUploadRouter(config: AppConfig) {
  const router = Router();
  const service = createUploadService(config);
  router.use(async (req, res, next) => {
    try {
      if (!service) {
        res.status(503).json({ error: { code: "UPLOADS_UNAVAILABLE", message: "Der Bildupload ist noch nicht eingerichtet." } });
        return;
      }
      if (!await consumePublicApiRateLimit(req.ip ?? "unknown", config.betterAuthSecret, "image-upload", 120)) {
        res.setHeader("Retry-After", "60");
        res.status(429).json({ error: { code: "RATE_LIMITED", message: "Zu viele Bilduploads. Bitte warten Sie eine Minute." } });
        return;
      }
      next();
    } catch (error) { next(error); }
  });
  router.post("/", async (req, res, next) => {
    try {
      const size = validateUploadRequest(req.body);
      res.setHeader("Cache-Control", "no-store");
      res.status(201).json({ data: await service!.initiate(size) });
    } catch (error) {
      if (error instanceof UploadError) res.status(error.status).json({ error: { code: error.code, message: error.message } });
      else {
        req.log.warn({ code: "IMAGE_STORAGE_FAILED" }, "image storage request failed");
        res.status(502).json({ error: { code: "IMAGE_STORAGE_FAILED", message: "Der Google-Bildspeicher ist derzeit nicht erreichbar. Bitte versuchen Sie es erneut." } });
      }
    }
  });
  router.post("/:id/complete", async (req, res, next) => {
    try {
      if (typeof req.body?.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(req.body.token) || !/^[a-f0-9-]{36}$/.test(req.params.id ?? "")) {
        throw new UploadError("INVALID_UPLOAD_CLAIM", 400, "Ungültige Upload-Bestätigung.");
      }
      await service!.complete(req.params.id!, req.body.token);
      res.setHeader("Cache-Control", "no-store");
      res.json({ data: { verified: true } });
    } catch (error) {
      if (error instanceof UploadError) res.status(error.status).json({ error: { code: error.code, message: error.message } });
      else {
        req.log.warn({ code: "IMAGE_STORAGE_FAILED" }, "image storage verification failed");
        res.status(502).json({ error: { code: "IMAGE_STORAGE_FAILED", message: "Das Bild konnte im Google-Bildspeicher nicht bestätigt werden. Bitte versuchen Sie es erneut." } });
      }
    }
  });
  return router;
}
