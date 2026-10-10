/**
 * Shared e-mail validation for server input checks and client UX hints.
 * Uses only bounded string operations (no backtracking regular expression)
 * so adversarial local/domain shapes cannot trigger ReDoS.
 */
export function isValidEmailAddress(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > 254) return false;
  // Single-character whitespace scan: linear, no nested quantifiers.
  if (/\s/u.test(value)) return false;
  const at = value.indexOf("@");
  if (at <= 0 || at !== value.lastIndexOf("@") || at === value.length - 1) return false;
  const domain = value.slice(at + 1);
  if (domain.indexOf(".") <= 0 || domain.endsWith(".")) return false;
  return true;
}
