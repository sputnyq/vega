import { prisma } from "../prisma.js";
import { revokeStaffAccess, StaffError } from "./staff-service.js";

export async function recoverSoleAdmin(userId: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM user ORDER BY id FOR UPDATE`;
    const admins = await tx.user.findMany({ where: { role: "Admin", blocked: false }, select: { id: true } });
    if (admins.length !== 1 || admins[0]?.id !== userId) {
      throw new StaffError(409, "NOT_SOLE_ADMIN", "Recovery ist nur für den einzigen aktiven Admin erlaubt. Andernfalls einen anderen Admin verwenden.");
    }
    await revokeStaffAccess(tx, userId);
    await tx.twoFactor.deleteMany({ where: { userId } });
    await tx.user.update({ where: { id: userId }, data: { twoFactorEnabled: false } });
  });
}
