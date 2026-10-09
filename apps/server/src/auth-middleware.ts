import type { RequestHandler } from "express";
import { fromNodeHeaders } from "better-auth/node";
import type { createAuth } from "./auth-config.js";

type AuthInstance = ReturnType<typeof createAuth>;

function reject(res: Parameters<RequestHandler>[1], status: number, code: string, message: string) {
  res.status(status).json({ error: { code, message } });
}

export function requireCompletedStaff(auth: AuthInstance): RequestHandler {
  return async (req, res, next) => {
    try {
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      if (!session) {
        reject(res, 401, "UNAUTHENTICATED", "Bitte melden Sie sich an.");
        return;
      }

      const user = session.user;
      if (user.blocked) {
        reject(res, 403, "ACCOUNT_BLOCKED", "Dieses Konto ist gesperrt.");
        return;
      }
      if (user.mustChangePassword) {
        reject(res, 403, "PASSWORD_CHANGE_REQUIRED", "Bitte ändern Sie zuerst Ihr Passwort.");
        return;
      }
      if (!user.twoFactorEnabled) {
        reject(res, 403, "TWO_FACTOR_SETUP_REQUIRED", "Bitte richten Sie zuerst die Zwei-Faktor-Anmeldung ein.");
        return;
      }
      if (user.role !== "Admin" && user.role !== "Kundenberater") {
        reject(res, 403, "FORBIDDEN", "Für diese Aktion fehlen die Berechtigungen.");
        return;
      }

      res.locals.staffUser = user;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requireAdmin(auth: AuthInstance): RequestHandler {
  const requireCompleted = requireCompletedStaff(auth);
  return (req, res, next) => {
    requireCompleted(req, res, (error?: unknown) => {
      if (error) return next(error);
      if (res.locals.staffUser?.role !== "Admin") {
        reject(res, 403, "FORBIDDEN", "Für diese Aktion fehlen die Berechtigungen.");
        return;
      }
      next();
    });
  };
}
