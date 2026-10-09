import { createHash, randomBytes, randomUUID } from "node:crypto";
import { Storage, type BucketMetadata } from "@google-cloud/storage";
import sharp from "sharp";
import type { Prisma } from "@prisma/client";
import type { AppConfig } from "../config.js";
import { prisma } from "../prisma.js";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const UPLOAD_TTL_MS = 15 * 60 * 1000;
export const CLAIM_TTL_MS = 24 * 60 * 60 * 1000;
export const hashUploadToken = (token: string) => createHash("sha256").update(token).digest("hex");
const EU_LOCATIONS = new Set(["EU", "EUR4", "EUROPE-WEST1", "EUROPE-WEST3", "EUROPE-WEST4", "EUROPE-WEST8", "EUROPE-WEST9", "EUROPE-WEST10", "EUROPE-WEST12", "EUROPE-NORTH1", "EUROPE-CENTRAL2", "EUROPE-SOUTHWEST1"]);

export function verifyBucketPolicy(metadata: Pick<BucketMetadata, "location" | "iamConfiguration" | "lifecycle">) {
  const rules = metadata.lifecycle?.rule ?? [];
  if (!EU_LOCATIONS.has(metadata.location?.toUpperCase() ?? "")
    || metadata.iamConfiguration?.publicAccessPrevention !== "enforced"
    || metadata.iamConfiguration.uniformBucketLevelAccess?.enabled !== true
    || rules.length !== 1 || rules[0]?.action?.type !== "Delete" || rules[0].condition?.age !== 180
    || Object.keys(rules[0].condition).some((key) => key !== "age")) {
    throw new UploadError("UNSAFE_BUCKET_CONFIGURATION", 503, "Der Bildspeicher benötigt eine private EU-Konfiguration mit einer Löschfrist von 180 Tagen.");
  }
}

export class UploadError extends Error {
  constructor(public readonly code: string, public readonly status: number, message: string) {
    super(message);
  }
}

export function validateUploadRequest(body: unknown): number {
  if (typeof body !== "object" || body === null || !("size" in body) || !("contentType" in body)
    || body.contentType !== "image/jpeg" || !Number.isSafeInteger(body.size)
    || typeof body.size !== "number" || body.size < 1 || body.size > MAX_IMAGE_BYTES) {
    throw new UploadError("INVALID_IMAGE", 400, "Nur JPEG-Bilder bis 10 MB sind erlaubt.");
  }
  return body.size;
}

export async function verifyJpeg(bytes: Buffer, expectedSize: number) {
  if (bytes.length !== expectedSize || bytes.length > MAX_IMAGE_BYTES) {
    throw new UploadError("INVALID_IMAGE_SIZE", 400, "Die Bildgröße stimmt nicht mit dem Upload überein.");
  }
  try {
    const image = sharp(bytes, { limitInputPixels: 4_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if (metadata.format !== "jpeg" || !metadata.width || !metadata.height || metadata.width > 2000 || metadata.height > 2000) {
      throw new UploadError("INVALID_IMAGE", 400, "Das Bild muss JPEG sein und darf höchstens 2000 Pixel je Kante haben.");
    }
    await image.raw().toBuffer();
  } catch (error) {
    if (error instanceof UploadError) throw error;
    throw new UploadError("INVALID_IMAGE", 400, "Die Bilddatei ist beschädigt oder ungültig.");
  }
}

export function createUploadService(config: AppConfig) {
  if (!config.gcs) return null;
  const bucket = new Storage(config.gcs.projectId ? { projectId: config.gcs.projectId } : {}).bucket(config.gcs.bucket);
  let policyCheckedAt = 0;
  async function ensureBucketPolicy() {
    if (Date.now() - policyCheckedAt < 5 * 60 * 1000) return;
    const [metadata] = await bucket.getMetadata();
    verifyBucketPolicy(metadata);
    policyCheckedAt = Date.now();
  }
  return {
    async initiate(size: number) {
      await ensureBucketPolicy();
      const id = randomUUID();
      const token = randomBytes(32).toString("base64url");
      const objectKey = `customer-images/staging/${id}.jpg`;
      const expires = new Date(Date.now() + UPLOAD_TTL_MS);
      const [policy] = await bucket.file(objectKey).generateSignedPostPolicyV4({
        expires,
        fields: { "Content-Type": "image/jpeg", success_action_status: "201" },
        conditions: [
          ["content-length-range", size, size],
          ["eq", "$Content-Type", "image/jpeg"],
          ["eq", "$success_action_status", "201"],
        ],
      });
      await prisma.orderImage.create({ data: {
        id, tokenHash: hashUploadToken(token), objectKey, size,
        expiresAt: new Date(Date.now() + CLAIM_TTL_MS),
      } });
      return { id, token, url: policy.url, fields: policy.fields, expiresAt: expires.toISOString() };
    },
    async complete(id: string, token: string) {
      const image = await prisma.orderImage.findFirst({ where: {
        id, tokenHash: hashUploadToken(token), orderId: null, expiresAt: { gt: new Date() },
      } });
      if (!image) throw new UploadError("INVALID_UPLOAD_CLAIM", 400, "Der Bildupload ist abgelaufen oder ungültig.");
      if (image.verifiedAt) return;
      const file = bucket.file(image.objectKey);
      const [metadata] = await file.getMetadata();
      if (metadata.contentType !== "image/jpeg" || Number(metadata.size) !== image.size || !metadata.generation) {
        throw new UploadError("INVALID_IMAGE", 400, "Der Upload enthält keine gültige Bilddatei.");
      }
      const pinnedFile = bucket.file(image.objectKey, { generation: metadata.generation });
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of pinnedFile.createReadStream({ end: MAX_IMAGE_BYTES })) {
        const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += bytes.length;
        if (size > MAX_IMAGE_BYTES) throw new UploadError("INVALID_IMAGE_SIZE", 400, "Das Bild überschreitet 10 MB.");
        chunks.push(bytes);
      }
      await verifyJpeg(Buffer.concat(chunks), image.size);
      const finalKey = `customer-images/final/${id}.jpg`;
      try {
        await pinnedFile.copy(bucket.file(finalKey), { preconditionOpts: { ifGenerationMatch: 0 } });
      } catch (error) {
        if (typeof error !== "object" || error === null || !("code" in error) || error.code !== 412) throw error;
      }
      const [finalMetadata] = await bucket.file(finalKey).getMetadata();
      if (!finalMetadata.generation) throw new UploadError("UPLOAD_VERIFICATION_FAILED", 502, "Der Bildupload konnte nicht bestätigt werden.");
      const updated = await prisma.orderImage.updateMany({
        where: { id, orderId: null, expiresAt: { gt: new Date() } },
        data: { verifiedAt: new Date(), generation: String(finalMetadata.generation), objectKey: finalKey },
      });
      if (!updated.count) throw new UploadError("INVALID_UPLOAD_CLAIM", 400, "Der Bildupload ist abgelaufen oder bereits zugeordnet.");
    },
    async list(orderId: string) {
      const images = await prisma.orderImage.findMany({ where: { orderId }, orderBy: { createdAt: "asc" } });
      return Promise.all(images.map(async (image) => {
        try {
          const [url] = await bucket.file(image.objectKey, image.generation ? { generation: image.generation } : {}).getSignedUrl({
            action: "read", expires: Date.now() + 5 * 60 * 1000,
          });
          return { id: image.id, url };
        } catch {
          throw new UploadError("IMAGE_STORAGE_FAILED", 502, "Die Bilder können derzeit nicht aus dem Google-Bildspeicher geladen werden.");
        }
      }));
    },
  };
}

export async function attachUploadClaims(transaction: {
  orderImage: { updateMany: (args: Prisma.OrderImageUpdateManyArgs) => Promise<{ count: number }> };
}, orderId: string, claims: Array<{ id: string; token: string }>) {
  for (const claim of claims) {
    const updated = await transaction.orderImage.updateMany({
      where: { id: claim.id, tokenHash: hashUploadToken(claim.token), orderId: null, verifiedAt: { not: null }, expiresAt: { gt: new Date() } },
      data: { orderId },
    });
    if (updated.count !== 1) throw new UploadError("INVALID_UPLOAD_CLAIM", 400, "Ein Bild ist abgelaufen, nicht bestätigt oder bereits zugeordnet. Bitte laden Sie es erneut hoch.");
  }
}
