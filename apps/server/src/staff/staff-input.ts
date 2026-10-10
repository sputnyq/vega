import type { UserRole } from "@vega/domain";
import { isValidEmailAddress } from "@vega/domain";
import { meetsPasswordPolicy } from "../password-policy.js";

export type StaffAction = { kind: "role"; role: UserRole } | { kind: "block"; blocked: boolean } | { kind: "reset-totp" } | { kind: "reset-password" };
export interface StaffCreate { name: string; email: string; role: UserRole; initialPassword: string }
const isRole = (value: unknown): value is UserRole => value === "Admin" || value === "Kundenberater";
export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function validateStaffCreate(value: unknown): StaffCreate | null {
  if (!record(value) || Object.keys(value).some((key) => !["name", "email", "role", "initialPassword", "currentPassword"].includes(key))
    || typeof value.name !== "string" || !value.name.trim() || value.name.trim().length > 191 || /[\r\n]/u.test(value.name)
    || typeof value.email !== "string" || !isValidEmailAddress(value.email.trim())
    || !isRole(value.role) || typeof value.initialPassword !== "string" || !meetsPasswordPolicy(value.initialPassword)) return null;
  return { name: value.name.trim(), email: value.email.trim().toLowerCase(), role: value.role, initialPassword: value.initialPassword };
}
export function validateStaffAction(value: unknown): StaffAction | null {
  if (!record(value)) return null;
  const allowed = value.kind === "role" ? ["kind", "role", "currentPassword"] : value.kind === "block" ? ["kind", "blocked", "currentPassword"] : ["kind", "currentPassword"];
  if (Object.keys(value).some((key) => !allowed.includes(key))) return null;
  if (value.kind === "role" && isRole(value.role)) return { kind: "role", role: value.role };
  if (value.kind === "block" && typeof value.blocked === "boolean") return { kind: "block", blocked: value.blocked };
  if (value.kind === "reset-totp" || value.kind === "reset-password") return { kind: value.kind };
  return null;
}
