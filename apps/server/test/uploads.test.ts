import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import type { Prisma } from "../src/generated/prisma/client.js";
import { attachUploadClaims, hashUploadToken, MAX_IMAGE_BYTES, UploadError, validateUploadRequest, verifyBucketPolicy, verifyJpeg } from "../src/uploads/upload-service.js";
import { validateOrderCreateInput } from "../src/orders/order-input.js";

test("upload initiation only accepts bounded JPEG metadata", () => {
  assert.equal(validateUploadRequest({ contentType: "image/jpeg", size: MAX_IMAGE_BYTES }), MAX_IMAGE_BYTES);
  for (const body of [null, {}, { contentType: "application/pdf", size: 10 }, { contentType: "image/jpeg", size: MAX_IMAGE_BYTES + 1 }, { contentType: "image/jpeg", size: 0 }, { contentType: "image/jpeg", size: 3.5 }]) {
    assert.throws(() => validateUploadRequest(body), UploadError);
  }
});
test("verification decodes real JPEG bytes and rejects disguised, corrupt and oversized images", async () => {
  const jpeg = await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "white" } }).jpeg().toBuffer();
  await verifyJpeg(jpeg, jpeg.length);
  await assert.rejects(verifyJpeg(jpeg, jpeg.length + 1), /Bildgröße/);
  const png = await sharp({ create: { width: 100, height: 100, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(verifyJpeg(png, png.length), /JPEG/);
  const oversized = await sharp({ create: { width: 2001, height: 100, channels: 3, background: "white" } }).jpeg().toBuffer();
  await assert.rejects(verifyJpeg(oversized, oversized.length), /2000/);
  const corrupt = Buffer.from("not-an-image");
  await assert.rejects(verifyJpeg(corrupt, corrupt.length), /beschädigt/);
  await assert.rejects(verifyJpeg(jpeg.subarray(0, 100), 100), UploadError);
});
test("bucket must enforce privacy, EU residency and exactly the 180-day lifecycle", () => {
  const policy = {
    location: "EUROPE-WEST3",
    iamConfiguration: { publicAccessPrevention: "enforced", uniformBucketLevelAccess: { enabled: true } },
    lifecycle: { rule: [{ action: { type: "Delete" }, condition: { age: 180 } }] },
  };
  verifyBucketPolicy(policy);
  assert.throws(() => verifyBucketPolicy({ ...policy, location: "US" }), UploadError);
  assert.throws(() => verifyBucketPolicy({ ...policy, location: "EUROPE-WEST2" }), UploadError);
  assert.throws(() => verifyBucketPolicy({ ...policy, iamConfiguration: {} }), UploadError);
  assert.throws(() => verifyBucketPolicy({ ...policy, lifecycle: { rule: [{ action: { type: "Delete" }, condition: { age: 7 } }] } }), UploadError);
});
test("order attachment atomically consumes a verified unexpired claim and never persists its bearer token", async () => {
  const calls: Prisma.OrderImageUpdateManyArgs[] = [];
  const transaction = { orderImage: { updateMany: async (args: Prisma.OrderImageUpdateManyArgs) => { calls.push(args); return { count: 1 }; } } };
  await attachUploadClaims(transaction, "order-id", [{ id: "image-id", token: "unpredictable-test-token" }]);
  assert.deepEqual(calls[0]!.data, { orderId: "order-id" });
  assert.equal(calls[0]!.where?.tokenHash, hashUploadToken("unpredictable-test-token"));
  assert.equal(calls[0]!.where?.orderId, null);
  assert.deepEqual(calls[0]!.where?.verifiedAt, { not: null });
  assert.ok(calls[0]!.where?.expiresAt);
  assert.equal(JSON.stringify(calls).includes("unpredictable-test-token"), false);
  await assert.rejects(attachUploadClaims({ orderImage: { updateMany: async () => ({ count: 0 }) } }, "order-id", [{ id: "image-id", token: "wrong-token" }]), /nicht bestätigt oder bereits zugeordnet/);
});
test("order validator rejects malformed, duplicate and arbitrary public image references", () => {
  const input = { customer: { firstName: "Ada", lastName: "Beispiel", phone: "12345" }, from: { street: "Straße 1", postalCode: "80331", city: "München" }, to: { street: "Straße 2", postalCode: "80331", city: "München" }, movingDate: "2099-11-20" };
  const claim = { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", token: "a".repeat(43) };
  assert.equal(validateOrderCreateInput({ ...input, imageClaims: [claim] }).ok, true);
  assert.equal(validateOrderCreateInput({ ...input, imageClaims: [claim, claim] }).ok, false);
  assert.equal(validateOrderCreateInput({ ...input, imageClaims: [{ url: "https://attacker.test/picture" }] }).ok, false);
});
