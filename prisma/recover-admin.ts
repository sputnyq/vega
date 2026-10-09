import "dotenv/config";
import { prisma } from "../apps/server/src/prisma.js";
import { recoverSoleAdmin } from "../apps/server/src/staff/admin-recovery.js";

try {
  const [userId, acknowledgement, ...extra] = process.argv.slice(2);
  if (!userId || acknowledgement !== "--confirm-identity-and-backup" || extra.length) {
    throw new Error("Aufruf: npm run auth:recover-admin -- <user-id> --confirm-identity-and-backup. Identität und Datenbanksicherung vorab außerhalb der App prüfen.");
  }
  await recoverSoleAdmin(userId);
  console.info("Sitzungen, Authenticator und Recovery-Codes widerrufen. Admin muss sich mit seinem bestehenden Passwort anmelden und TOTP neu einrichten.");
} finally {
  await prisma.$disconnect();
}
