import "dotenv/config";
import { randomUUID } from "node:crypto";
import { prisma } from "../apps/server/src/prisma.js";
import { ensureInitialAdmin } from "../apps/server/src/initial-admin.js";

try {
  const result = await prisma.$transaction(async (tx) => ensureInitialAdmin({
    hasAdmin: async () => Boolean(await tx.user.findFirst({
      where: { role: "Admin" },
      select: { id: true },
    })),
    hasEmail: async (email) => Boolean(await tx.user.findUnique({
      where: { email },
      select: { id: true },
    })),
    create: async (record) => {
      const userId = randomUUID();
      await tx.user.create({
        data: {
          id: userId,
          name: record.name,
          email: record.email,
          emailVerified: record.emailVerified,
          role: record.role,
          mustChangePassword: record.mustChangePassword,
          accounts: {
            create: {
              id: randomUUID(),
              accountId: userId,
              providerId: "credential",
              password: record.passwordHash,
            },
          },
        },
      });
    },
  }, process.env), { isolationLevel: "Serializable" });

  if (result === "created") {
    console.info("Initial admin created. Remove the bootstrap environment variables now.");
  } else if (result === "already-exists") {
    console.info("An admin already exists; no account or password was changed.");
  } else {
    console.info("Initial admin seed skipped; set both bootstrap variables to create the first admin.");
  }
} finally {
  await prisma.$disconnect();
}
