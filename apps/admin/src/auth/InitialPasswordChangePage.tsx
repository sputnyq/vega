import { useState, type FormEvent } from "react";
import { Alert, Box, Button, CircularProgress, Stack, Typography } from "@mui/material";
import { meetsPasswordPolicy, passwordPolicyError, passwordPolicyHelp } from "../password-policy.js";
import { AuthCard } from "./AuthCard.js";
import { PasswordField } from "./PasswordField.js";

interface InitialPasswordChangePageProps {
  currentPassword?: string;
  onChanged: (newPassword: string) => void;
}

export function InitialPasswordChangePage({ currentPassword: initialCurrentPassword, onChanged }: InitialPasswordChangePageProps) {
  const [currentPassword, setCurrentPassword] = useState(initialCurrentPassword ?? "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmation) {
      setError("Die neuen Passwörter stimmen nicht überein.");
      return;
    }
    if (!meetsPasswordPolicy(newPassword)) {
      setError(passwordPolicyError);
      return;
    }
    if (newPassword === currentPassword) {
      setError("Das neue Passwort muss sich vom Initialpasswort unterscheiden.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/admin/auth/initial-password", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!response.ok) {
        setError("Das Passwort konnte nicht geändert werden. Prüfen Sie das aktuelle Passwort und versuchen Sie es erneut.");
        return;
      }
      onChanged(newPassword);
    } catch {
      setError("Der Server ist momentan nicht erreichbar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthCard>
      <Typography variant="overline" color="primary">Vega · Ersteinrichtung</Typography>
      <Typography component="h1" variant="h4">Initialpasswort ändern</Typography>
      <Typography color="text.secondary">
        Vor dem Zugriff auf die Verwaltung müssen Sie ein persönliches Passwort festlegen.
      </Typography>
      <Box component="form" onSubmit={submit}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {!initialCurrentPassword && (
            <PasswordField
              autoComplete="current-password"
              label="Aktuelles Initialpasswort"
              value={currentPassword}
              onChange={setCurrentPassword}
            />
          )}
          <PasswordField
            autoFocus
            autoComplete="new-password"
            label="Neues Passwort"
            helperText={passwordPolicyHelp}
            value={newPassword}
            onChange={setNewPassword}
            minLength={8}
            maxLength={128}
          />
          <PasswordField
            autoComplete="new-password"
            label="Neues Passwort wiederholen"
            value={confirmation}
            onChange={setConfirmation}
            minLength={8}
            maxLength={128}
          />
          <Button type="submit" variant="contained" disabled={busy} size="large">
            {busy ? <CircularProgress size={24} color="inherit" /> : "Passwort festlegen"}
          </Button>
        </Stack>
      </Box>
    </AuthCard>
  );
}
