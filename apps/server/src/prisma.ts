import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { loadDatabaseConfig } from "./database-config.js";
import { PrismaClient } from "./generated/prisma/client.js";

const globalForPrisma = globalThis as typeof globalThis & {
  vegaPrisma?: PrismaClient;
};

export const prisma = globalForPrisma.vegaPrisma ?? new PrismaClient({
  adapter: new PrismaMariaDb(loadDatabaseConfig()),
});

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.vegaPrisma = prisma;
}
