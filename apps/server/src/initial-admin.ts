import { hashPassword } from "better-auth/crypto";
import { isValidEmailAddress } from "@vega/domain";
import { meetsPasswordPolicy, PASSWORD_POLICY_MESSAGE } from "./password-policy.js";

const INITIAL_ADMIN_NAME = "root_user";

export interface InitialAdminRecord {
  email: string;
  name: string;
  passwordHash: string;
  role: "Admin";
  mustChangePassword: true;
  emailVerified: false;
}

export interface InitialAdminRepository {
  hasAdmin(): Promise<boolean>;
  hasEmail(email: string): Promise<boolean>;
  create(record: InitialAdminRecord): Promise<void>;
}

export type InitialAdminResult = "created" | "already-exists" | "skipped";

export async function ensureInitialAdmin(
  repository: InitialAdminRepository,
  env: NodeJS.ProcessEnv = process.env,
): Promise<InitialAdminResult> {
  if (await repository.hasAdmin()) return "already-exists";

  const email = env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = env.INITIAL_ADMIN_PASSWORD;
  if (!email && !password) return "skipped";

  if (!email || !isValidEmailAddress(email)) {
    throw new Error("INITIAL_ADMIN_EMAIL muss eine gültige E-Mail-Adresse enthalten.");
  }
  if (!password || !meetsPasswordPolicy(password)) {
    throw new Error(`INITIAL_ADMIN_PASSWORD: ${PASSWORD_POLICY_MESSAGE}`);
  }
  if (await repository.hasEmail(email)) {
    throw new Error("INITIAL_ADMIN_EMAIL wird bereits von einem Nicht-Admin-Konto verwendet.");
  }

  const passwordHash = await hashPassword(password);
  await repository.create({
    email,
    name: INITIAL_ADMIN_NAME,
    passwordHash,
    role: "Admin",
    mustChangePassword: true,
    emailVerified: false,
  });

  return "created";
}
