import { createHash, createHmac } from "node:crypto";
import { prisma } from "./prisma.js";

const WINDOW_MS = 60_000;
let requestCount = 0;

export async function consumePublicApiRateLimit(
  ipAddress: string,
  secret: string,
  namespace: string,
  limit: number,
  now = new Date(),
): Promise<boolean> {
  const windowStartedAt = new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS);
  const ipHash = createHmac("sha256", secret).update(ipAddress).digest("hex");
  const key = createHash("sha256").update(`${namespace}:${ipHash}:${windowStartedAt.toISOString()}`).digest("hex");
  const counter = await prisma.publicApiRateLimit.upsert({
    where: { key },
    create: { key, windowStartedAt, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  requestCount += 1;
  if (requestCount % 128 === 0) {
    await prisma.publicApiRateLimit.deleteMany({
      where: { windowStartedAt: { lt: new Date(now.getTime() - 60 * 60 * 1000) } },
    });
  }
  return counter.count <= limit;
}
