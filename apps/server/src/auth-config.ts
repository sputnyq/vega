import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { twoFactor } from "better-auth/plugins";
import type { AppConfig } from "./config.js";
import { meetsPasswordPolicy, PASSWORD_POLICY_MESSAGE } from "./password-policy.js";
import { prisma } from "./prisma.js";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export function createAuth(config: AppConfig) {
  return betterAuth({
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
        "/api/auth/sign-in/email": { window: 60, max: 5 },
        "/api/auth/two-factor/verify-totp": { window: 60, max: 5 },
        "/api/auth/two-factor/verify-backup-code": { window: 60, max: 5 },
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
      }),
    ],
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
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
}
