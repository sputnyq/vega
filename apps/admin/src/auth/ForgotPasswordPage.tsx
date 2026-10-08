import { useState, type FormEvent } from "react";
import { Alert, Box, Button, CircularProgress, Stack, TextField, Typography } from "@mui/material";
import { authClient } from "../auth-client.js";
import { AuthCard } from "./AuthCard.js";

export function ForgotPasswordPage({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      // The server deliberately returns the same success response for known and unknown accounts.
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (result.error) {
        setError("Die Anfrage konnte nicht verarbeitet werden. Bitte versuchen Sie es später erneut.");
        return;
      }
      setSent(true);
    } catch {
      setError("Die Anfrage konnte nicht verarbeitet werden. Bitte versuchen Sie es später erneut.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard>
      <Typography variant="overline" color="primary">Vega · Verwaltung</Typography>
      <Typography component="h1" variant="h4">Passwort zurücksetzen</Typography>
      {sent ? (
        <Stack spacing={2}>
          <Alert severity="success">Falls ein Konto zu dieser E-Mail-Adresse existiert, wurde ein Link zum Zurücksetzen versendet.</Alert>
          <Button onClick={onBack}>Zur Anmeldung</Button>
        </Stack>
      ) : (
        <>
          <Typography color="text.secondary">Geben Sie Ihre Mitarbeiter-E-Mail-Adresse ein. Der Link ist nur einmal und zeitlich begrenzt verwendbar.</Typography>
          <Box component="form" onSubmit={submit}>
            <Stack spacing={2}>
              {error && <Alert severity="error">{error}</Alert>}
              <TextField autoFocus autoComplete="email" label="E-Mail-Adresse" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <Button type="submit" variant="contained" size="large" disabled={busy}>
                {busy ? <CircularProgress size={24} color="inherit" /> : "Reset-Link anfordern"}
              </Button>
              <Button type="button" onClick={onBack}>Zur Anmeldung</Button>
            </Stack>
          </Box>
        </>
      )}
    </AuthCard>
  );
}
