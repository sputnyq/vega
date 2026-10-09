import { AsyncLocalStorage } from "node:async_hooks";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins/two-factor";
import type { AppConfig } from "./config.js";
import { meetsPasswordPolicy, PASSWORD_POLICY_MESSAGE } from "./password-policy.js";
import { prisma } from "./prisma.js";
import { createConfiguredMailService } from "./mail/configured-mail-service.js";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function createAuth(config: AppConfig) {
  const resetDelivery = new AsyncLocalStorage<{ sent: boolean }>();
  const auth = betterAuth({
    appName: "Vega",
    baseURL: config.betterAuthUrl.toString(),
    secret: config.betterAuthSecret,
    trustedOrigins: config.betterAuthTrustedOrigins,
    database: prismaAdapter(prisma, { provider: "mysql" }),
    emailAndPassword: {
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: false,
      minPasswordLength: 8,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      sendResetPassword: async ({ user, url }) => {
        const mailService = createConfiguredMailService(config);
        if (!mailService) {
          // This is a deployment misconfiguration; do not expose it to the reset caller.
          throw new Error("MAIL_NOT_CONFIGURED");
        }
        await mailService.sendPasswordReset(user.email, url);
        const attempt = resetDelivery.getStore();
        if (attempt) attempt.sent = true;
      },
    },
    user: {
      additionalFields: {
        role: {
          type: "string",
          required: true,
          defaultValue: "Kundenberater",
          input: false,
        },
        mustChangePassword: {
          type: "boolean",
          required: true,
          defaultValue: false,
          input: false,
        },
        blocked: {
          type: "boolean",
          required: true,
          defaultValue: false,
          input: false,
        },
      },
    },
    session: {
      expiresIn: SESSION_MAX_AGE_SECONDS,
      updateAge: 24 * 60 * 60,
      disableSessionRefresh: true,
      cookieCache: { enabled: false },
    },
    rateLimit: {
      enabled: config.nodeEnv !== "test",
      storage: "database",
      customRules: {
        "/sign-in/email": { window: 60, max: 5 },
        "/request-password-reset": { window: 60, max: 3 },
        "/two-factor/verify-totp": { window: 60, max: 5 },
        "/two-factor/verify-backup-code": { window: 60, max: 5 },
      },
    },
    advanced: {
      useSecureCookies: config.nodeEnv === "production",
      defaultCookieAttributes: { sameSite: "lax" },
      ipAddress: { ipAddressHeaders: [] },
    },
    plugins: [
      twoFactor({
        issuer: "Vega",
        skipVerificationOnEnable: false,
        backupCodeOptions: { storeBackupCodes: "encrypted" },
      }),
    ],
    databaseHooks: {
      session: {
        create: {
          before: async (session) => {
            const user = await prisma.user.findUnique({ where: { id: session.userId }, select: { blocked: true } });
            if (!user || user.blocked) throw new APIError("UNAUTHORIZED", { code: "INVALID_EMAIL_OR_PASSWORD", message: "Anmeldung nicht möglich." });
          },
        },
      },
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/two-factor/disable"
          || (ctx.path === "/two-factor/enable" && ctx.body?.method !== undefined && ctx.body.method !== "totp")
          || (ctx.path.startsWith("/two-factor/") && ctx.body?.trustDevice === true)) {
          throw new APIError("FORBIDDEN", { code: "MANDATORY_TOTP", message: "TOTP darf nicht deaktiviert oder durch ein vertrauenswürdiges Gerät umgangen werden." });
        }
        const passwordEndpoints = new Set([
          "/sign-up/email",
          "/change-password",
          "/reset-password",
          "/set-password",
          "/admin/create-user",
          "/admin/set-user-password",
        ]);
        if (!passwordEndpoints.has(ctx.path)) return;

        const body = ctx.body as Record<string, unknown> | undefined;
        const password = ctx.path === "/sign-up/email"
          ? body?.password
          : body?.newPassword ?? body?.password;
        if (typeof password === "string" && !meetsPasswordPolicy(password)) {
          throw new APIError("BAD_REQUEST", {
            code: "PASSWORD_POLICY",
            message: PASSWORD_POLICY_MESSAGE,
          });
        }
      }),
    },
  });
  return Object.assign(auth, {
    async requestStaffPasswordReset(body: { email: string; redirectTo: string }) {
      const attempt = { sent: false };
      // Better Auth intentionally swallows reset-mail failures for the anonymous endpoint.
      await resetDelivery.run(attempt, () => auth.api.requestPasswordReset({ body }));
      if (!attempt.sent) throw new Error("PASSWORD_RESET_MAIL_FAILED");
    },
  });
}
