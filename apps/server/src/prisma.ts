import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  vegaPrisma?: PrismaClient;
};

export const prisma = globalForPrisma.vegaPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.vegaPrisma = prisma;
}
