import type { AppSettingsDto } from "@vega/domain";
import { isValidEmailAddress } from "@vega/domain";

export const EMPTY_SETTINGS: AppSettingsDto = {
  revision: 0, boxCbm: null, kleiderboxCbm: null, origin: null, dataPrivacyUrl: null, successUrl: null,
  boxCalculatorUrl: null, companyEmail: null, emailFromName: null, emailFromAddress: null,
};

export function validateSettings(value: unknown): { ok: true; value: AppSettingsDto } | { ok: false; issues: Array<{ field: string; message: string }> } {
  const issues: Array<{ field: string; message: string }> = [];
  if (typeof value !== "object" || value === null || Array.isArray(value)) return { ok: false, issues: [{ field: "body", message: "Ungültige Einstellungen." }] };
  const raw = value as Record<string, unknown>;
  const result = { ...EMPTY_SETTINGS };
  if (!Number.isSafeInteger(raw.revision) || typeof raw.revision !== "number" || raw.revision < 0) {
    issues.push({ field: "revision", message: "Bitte laden Sie die Einstellungen erneut." });
  } else result.revision = raw.revision;
  for (const key of Object.keys(raw)) if (!Object.hasOwn(EMPTY_SETTINGS, key)) issues.push({ field: key, message: "Diese Einstellung ist nicht freigegeben." });
  for (const key of ["boxCbm", "kleiderboxCbm"] as const) {
    const number = raw[key];
    if (number === null) result[key] = null;
    else if (typeof number !== "number" || !Number.isFinite(number) || number <= 0 || number > 10 || Math.abs(number * 10000 - Math.round(number * 10000)) > 1e-8) {
      issues.push({ field: key, message: "Das Volumen muss größer als 0 und höchstens 10 m³ sein (maximal vier Nachkommastellen)." });
    } else result[key] = number;
  }
  for (const key of ["origin", "dataPrivacyUrl", "successUrl", "boxCalculatorUrl", "companyEmail", "emailFromName", "emailFromAddress"] as const) {
    const text = raw[key];
    if (text === null || text === "") { result[key] = null; continue; }
    if (typeof text !== "string") { issues.push({ field: key, message: "Ungültiger Textwert." }); continue; }
    const trimmed = text.trim();
    if (!trimmed) { result[key] = null; continue; }
    const max = key.endsWith("Url") ? 2048 : key === "origin" ? 300 : key === "emailFromName" ? 191 : 254;
    if (trimmed.length > max || /[\u0000-\u001f\u007f]/u.test(trimmed)) {
      issues.push({ field: key, message: `Maximal ${max} Zeichen ohne Steuerzeichen erlaubt.` });
      continue;
    }
    if (key.endsWith("Url")) {
      try {
        const url = new URL(trimmed);
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("INVALID_URL");
      } catch {
        issues.push({ field: key, message: "Bitte geben Sie eine vollständige HTTP(S)-URL ohne Zugangsdaten ein." });
        continue;
      }
    }
    if ((key === "companyEmail" || key === "emailFromAddress") && !isValidEmailAddress(trimmed)) {
      issues.push({ field: key, message: "Bitte geben Sie eine gültige E-Mail-Adresse ein." });
      continue;
    }
    result[key] = trimmed;
  }
  return issues.length ? { ok: false, issues } : { ok: true, value: result };
}

export function validateInvoiceSequence(value: unknown): { nextValue: number; expectedNextValue: number } | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || !("nextValue" in value) || !("expectedNextValue" in value)
    || Object.keys(value).some((key) => key !== "nextValue" && key !== "expectedNextValue")) return null;
  const { nextValue, expectedNextValue } = value;
  if (typeof nextValue !== "number" || typeof expectedNextValue !== "number"
    || ![nextValue, expectedNextValue].every((number) => Number.isSafeInteger(number) && number > 0 && number < 2_147_483_647)) return null;
  return { nextValue, expectedNextValue };
}
