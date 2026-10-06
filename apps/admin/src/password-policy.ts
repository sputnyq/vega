export const passwordPolicyHelp = "Mindestens 8 Zeichen, inklusive Großbuchstabe, Kleinbuchstabe und Zahl.";
export const passwordPolicyError = "Das Passwort muss mindestens 8 Zeichen sowie einen Großbuchstaben, einen Kleinbuchstaben und eine Zahl enthalten.";

export function meetsPasswordPolicy(password: string): boolean {
  return password.length >= 8
    && password.length <= 128
    && /[A-Z]/u.test(password)
    && /[a-z]/u.test(password)
    && /[0-9]/u.test(password);
}
