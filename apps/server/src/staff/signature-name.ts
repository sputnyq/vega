import { prisma } from "../prisma.js";

export const SIGNATURE_NAME_MAX = 100;

export type SignatureNameValidation = { ok: true; value: string | null } | { ok: false; message: string };

/** Empty input clears the signature; control characters would break the mail header block. */
export function validateSignatureName(input: unknown): SignatureNameValidation {
  if (input === null || input === undefined) return { ok: true, value: null };
  if (typeof input !== "string") return { ok: false, message: "Bitte geben Sie einen gültigen Namen ein." };
  const value = input.trim().replace(/\s+/gu, " ");
  if (!value) return { ok: true, value: null };
  if (value.length > SIGNATURE_NAME_MAX) return { ok: false, message: `Der Name darf höchstens ${SIGNATURE_NAME_MAX} Zeichen lang sein.` };
  if (/\p{Cc}/u.test(value)) return { ok: false, message: "Bitte geben Sie einen gültigen Namen ein." };
  return { ok: true, value };
}

export async function loadSignatureName(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { signatureName: true } });
  return user?.signatureName ?? null;
}
