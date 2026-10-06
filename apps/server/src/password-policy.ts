export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;
export const PASSWORD_POLICY_MESSAGE = "Das Passwort muss mindestens 8 Zeichen sowie einen Großbuchstaben, einen Kleinbuchstaben und eine Zahl enthalten.";

export function meetsPasswordPolicy(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH
    && password.length <= PASSWORD_MAX_LENGTH
    && /[A-Z]/u.test(password)
    && /[a-z]/u.test(password)
    && /[0-9]/u.test(password);
}
