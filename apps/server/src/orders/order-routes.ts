import { Router } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { createAuth } from "../auth-config.js";
import type { AppConfig } from "../config.js";
import { createOrder } from "./order-service.js";
import { consumePublicApiRateLimit } from "../public-rate-limit.js";
import { validateOrderCreateInput } from "./order-input.js";
import { createConfiguredMailService } from "../mail/configured-mail-service.js";
import { deliverOutboxMail } from "../mail/mail-outbox-service.js";

type AuthInstance = ReturnType<typeof createAuth>;

export function createOrderRouter(auth: AuthInstance, config: AppConfig) {
  const router = Router();

  // This is deliberately the only order write API callable without staff auth.
  // No order/customer read access is exposed by this router.
  router.post("/api/orders", async (req, res, next) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (session) {
        if (session.user.mustChangePassword || !session.user.twoFactorEnabled) {
          res.status(403).json({ error: { code: "STAFF_SETUP_REQUIRED", message: "Bitte schließen Sie zuerst die Kontoeinrichtung ab." } });
          return;
        }
        if (session.user.role !== "Admin" && session.user.role !== "Kundenberater") {
          res.status(403).json({ error: { code: "FORBIDDEN", message: "Für diese Aktion fehlen die Berechtigungen." } });
          return;
        }
      } else if (!await consumePublicApiRateLimit(req.ip ?? req.socket.remoteAddress ?? "unknown", config.betterAuthSecret, "order-create", 10)) {
        res.setHeader("Retry-After", String(60 - Math.floor(Date.now() / 1000) % 60));
        res.status(429).json({ error: { code: "RATE_LIMITED", message: "Zu viele Anfragen. Bitte versuchen Sie es später erneut." } });
        return;
      }

      const validation = validateOrderCreateInput(req.body, {
        allowStaffPricing: session !== null,
        allowIncomplete: session !== null,
      });
      if (!validation.ok) {
        res.status(400).json({
          error: {
            code: "INVALID_ORDER",
            message: "Bitte prüfen Sie die markierten Auftragsdaten.",
            issues: validation.issues,
          },
        });
        return;
      }

      const orderInput = session
        ? { ...validation.value, orderSource: validation.value.orderSource ?? "individuelle" }
        : { ...validation.value, orderSource: "umzugruckzuck24.de" as const };
      const created = await createOrder(orderInput, session ? "admin" : "public");
      const mailService = createConfiguredMailService(config);
      if (created.outboxId && mailService) {
        void deliverOutboxMail(created.outboxId, mailService).catch((error: unknown) => {
          // Never log recipient, subject, content, attachments, token, or provider body.
          req.log.warn({ outboxId: created.outboxId, code: error instanceof Error ? error.message : "MAIL_SEND_FAILED" }, "inquiry receipt delivery failed");
        });
      }
      res.setHeader("Cache-Control", "no-store");
      res.status(201).json({ data: { orderNumber: created.orderNumber } });
    } catch (error) {
      if (error instanceof Error && error.message === "INVALID_ORDER_CATALOG_REFERENCE") {
        res.status(400).json({ error: { code: "INVALID_ORDER_CATALOG_REFERENCE", message: "Eine ausgewählte Katalogposition ist nicht mehr verfügbar." } });
        return;
      }
      next(error);
    }
  });

  return router;
}
