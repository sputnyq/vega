import { useEffect, useState, type FormEvent } from "react";
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import { authClient } from "../auth-client.js";
import type { PendingInitialPassword, StaffUser } from "../types.js";
import { AuthCard } from "./AuthCard.js";
import { PasswordField } from "./PasswordField.js";

interface SignInPageProps {
  onInitialPassword: (pending: PendingInitialPassword) => void;
  onTotpSetup: (password: string) => void;
  twoFactorRequired: boolean;
  onTwoFactorRequired: () => void;
  onCancelTwoFactor: () => void;
}

export function SignInPage({
  onInitialPassword,
  onTotpSetup,
  twoFactorRequired,
  onTwoFactorRequired,
  onCancelTwoFactor,
}: SignInPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const handleTwoFactorRedirect = () => onTwoFactorRequired();
    window.addEventListener("vega-two-factor-required", handleTwoFactorRedirect);
    return () => window.removeEventListener("vega-two-factor-required", handleTwoFactorRedirect);
  }, [onTwoFactorRequired]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = await authClient.signIn.email({ email: email.trim(), password });
      if (result.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect) {
        onTwoFactorRequired();
        return;
      }
      if (result.error) {
        setError("Anmeldung nicht möglich. Bitte prüfen Sie Ihre Eingaben.");
        return;
      }

      const user = result.data?.user as unknown as StaffUser | undefined;
      if (user?.mustChangePassword) {
        onInitialPassword({ currentPassword: password });
      } else if (user?.twoFactorEnabled !== true) {
        onTotpSetup(password);
      } else {
        window.location.reload();
      }
    } catch {
      setError("Anmeldung nicht möglich. Bitte versuchen Sie es erneut.");
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const result = useBackupCode
        ? await authClient.twoFactor.verifyBackupCode({ code: code.trim(), trustDevice: false })
        : await authClient.twoFactor.verifyTotp({ code: code.trim(), trustDevice: false });
      if (result.error) {
        setError(useBackupCode
          ? "Der Wiederherstellungscode ist ungültig oder bereits verwendet."
          : "Der Code ist ungültig oder abgelaufen.");
        return;
      }
      window.location.reload();
    } catch {
      setError("Die Zwei-Faktor-Anmeldung ist fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard>
      <Typography variant="overline" color="primary">Vega · Verwaltung</Typography>
      <Typography component="h1" variant="h4">
        {twoFactorRequired ? "Zwei-Faktor-Code" : "Anmelden"}
      </Typography>
      <Typography color="text.secondary">
        {twoFactorRequired
          ? useBackupCode
            ? "Geben Sie einen unbenutzten Wiederherstellungscode ein."
            : "Geben Sie den aktuellen Code Ihrer Authenticator-App ein."
          : "Melden Sie sich mit Ihrem Mitarbeiterkonto an. Das Initialpasswort gilt nur für den ersten Login."}
      </Typography>
      <Box component="form" onSubmit={twoFactorRequired ? verifyCode : submit}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {twoFactorRequired ? (
            <TextField
              autoFocus
              autoComplete={useBackupCode ? "off" : "one-time-code"}
              label={useBackupCode ? "Wiederherstellungscode" : "6-stelliger Code"}
              inputMode={useBackupCode ? "text" : "numeric"}
              value={code}
              onChange={(event) => setCode(useBackupCode
                ? event.target.value.toUpperCase().trim().slice(0, 64)
                : event.target.value.replace(/\D/g, "").slice(0, 6))}
              required
            />
          ) : (
            <>
              <TextField
                autoFocus
                autoComplete="username"
                label="E-Mail-Adresse"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <PasswordField
                autoComplete="current-password"
                label="Passwort"
                value={password}
                onChange={setPassword}
              />
            </>
          )}
          <Button type="submit" variant="contained" disabled={busy} size="large">
            {busy ? <CircularProgress size={24} color="inherit" /> : twoFactorRequired ? "Code prüfen" : "Anmelden"}
          </Button>
          {twoFactorRequired && (
            <Stack spacing={1}>
              <Button type="button" onClick={() => { setUseBackupCode(!useBackupCode); setCode(""); setError(""); }}>
                {useBackupCode ? "Authenticator-Code verwenden" : "Wiederherstellungscode verwenden"}
              </Button>
              <Button type="button" onClick={() => { setUseBackupCode(false); setCode(""); setError(""); onCancelTwoFactor(); }}>
                Zurück zur Anmeldung
              </Button>
            </Stack>
          )}
        </Stack>
      </Box>
    </AuthCard>
  );
}
