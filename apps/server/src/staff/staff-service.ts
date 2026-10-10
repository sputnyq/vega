import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import type { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../prisma.js";
import type { StaffAction, StaffCreate } from "./staff-input.js";

export class StaffError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}
export const staffSelect = {
  id: true, name: true, email: true, role: true, blocked: true,
  mustChangePassword: true, twoFactorEnabled: true, createdAt: true,
} satisfies Prisma.UserSelect;

async function lockStaff(tx: Prisma.TransactionClient) {
  // Serialize lifecycle changes, including concurrent attempts to remove the last admin.
  await tx.$queryRaw`SELECT id FROM user ORDER BY id FOR UPDATE`;
}
async function requireActor(tx: Prisma.TransactionClient, actorId: string) {
  const actor = await tx.user.findUnique({ where: { id: actorId } });
  if (!actor || actor.blocked || actor.role !== "Admin" || actor.mustChangePassword || !actor.twoFactorEnabled) {
    throw new StaffError(403, "FORBIDDEN", "Für diese Aktion fehlen die Berechtigungen.");
  }
}
export async function revokeStaffAccess(tx: Prisma.TransactionClient, userId: string) {
  await tx.session.deleteMany({ where: { userId } });
  await tx.verification.deleteMany({ where: { value: userId } });
}
export async function createStaff(actorId: string, input: StaffCreate) {
  const password = await hashPassword(input.initialPassword);
  return prisma.$transaction(async (tx) => {
    await lockStaff(tx);
    await requireActor(tx, actorId);
    const id = randomUUID();
    return tx.user.create({ data: {
      id, name: input.name, email: input.email, role: input.role, mustChangePassword: true, blocked: false,
      accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password } },
    }, select: staffSelect });
  });
}
export async function staffResetTarget(actorId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    await lockStaff(tx);
    await requireActor(tx, actorId);
    const target = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
    if (!target) throw new StaffError(404, "STAFF_NOT_FOUND", "Mitarbeiterkonto nicht gefunden.");
    return target;
  });
}
export async function changeStaff(actorId: string, userId: string, action: Exclude<StaffAction, { kind: "reset-password" }>) {
  return prisma.$transaction(async (tx) => {
    await lockStaff(tx);
    await requireActor(tx, actorId);
    const target = await tx.user.findUnique({ where: { id: userId } });
    if (!target) throw new StaffError(404, "STAFF_NOT_FOUND", "Mitarbeiterkonto nicht gefunden.");
    if (actorId === userId && (action.kind === "reset-totp" || (action.kind === "block" && action.blocked) || (action.kind === "role" && action.role !== "Admin"))) {
      throw new StaffError(409, "SELF_LOCKOUT", "Das eigene Admin-Konto darf hier nicht gesperrt, herabgestuft oder zurückgesetzt werden.");
    }
    const removesAdmin = target.role === "Admin" && !target.blocked
      && ((action.kind === "block" && action.blocked) || (action.kind === "role" && action.role !== "Admin"));
    if (removesAdmin && await tx.user.count({ where: { role: "Admin", blocked: false } }) <= 1) {
      throw new StaffError(409, "LAST_ADMIN", "Der letzte aktive Admin muss erhalten bleiben.");
    }
    await revokeStaffAccess(tx, userId);
    if (action.kind === "reset-totp") await tx.twoFactor.deleteMany({ where: { userId } });
    return tx.user.update({ where: { id: userId }, data: action.kind === "role" ? { role: action.role }
      : action.kind === "block" ? { blocked: action.blocked } : { twoFactorEnabled: false }, select: staffSelect });
  });
}
