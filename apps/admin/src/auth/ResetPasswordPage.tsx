import { useState, type FormEvent } from "react";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { authClient } from "../auth-client.js";
import { meetsPasswordPolicy, passwordPolicyError, passwordPolicyHelp } from "../password-policy.js";
import { AuthCard } from "./AuthCard.js";
import { PasswordField } from "./PasswordField.js";

export function ResetPasswordPage({ onComplete }: { onComplete: () => void }) {
  const token = new URLSearchParams(window.location.search).get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [complete, setComplete] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!meetsPasswordPolicy(password)) {
      setError(passwordPolicyError);
      return;
    }
    if (password !== confirmation) {
      setError("Die neuen Passwörter stimmen nicht überein.");
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) {
        setError("Dieser Link ist ungültig oder abgelaufen. Fordern Sie bitte einen neuen Reset-Link an.");
        return;
      }
      setComplete(true);
      setPassword("");
      setConfirmation("");
    } catch {
      setError("Dieser Link ist ungültig oder abgelaufen. Fordern Sie bitte einen neuen Reset-Link an.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard>
      <Typography variant="overline" color="primary">Vega · Verwaltung</Typography>
      <Typography component="h1" variant="h4">Neues Passwort festlegen</Typography>
      {!token ? (
        <Stack spacing={2}>
          <Alert severity="error">Der Reset-Link ist unvollständig oder ungültig.</Alert>
          <Button onClick={onComplete}>Zur Anmeldung</Button>
        </Stack>
      ) : complete ? (
        <Stack spacing={2}>
          <Alert severity="success">Passwort geändert. Melden Sie sich nun mit Ihrem neuen Passwort und Ihrem Zwei-Faktor-Code an.</Alert>
          <Button variant="contained" onClick={onComplete}>Zur Anmeldung</Button>
        </Stack>
      ) : (
        <Box component="form" onSubmit={submit}>
          <Stack spacing={2}>
            <Typography color="text.secondary">{passwordPolicyHelp}</Typography>
            {error && <Alert severity="error">{error}</Alert>}
            <PasswordField autoFocus autoComplete="new-password" label="Neues Passwort" helperText={passwordPolicyHelp} value={password} onChange={setPassword} minLength={8} maxLength={128} />
            <PasswordField autoComplete="new-password" label="Neues Passwort wiederholen" value={confirmation} onChange={setConfirmation} minLength={8} maxLength={128} />
            <Button type="submit" variant="contained" size="large" disabled={busy}>
              {busy ? <CircularProgress size={24} color="inherit" /> : "Passwort speichern"}
            </Button>
          </Stack>
        </Box>
      )}
    </AuthCard>
  );
}
