import { useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { authClient } from "../auth-client.js";
import { meetsPasswordPolicy, passwordPolicyError, passwordPolicyHelp } from "../password-policy.js";
import type { StaffUser } from "../types.js";
import { PasswordField } from "../auth/PasswordField.js";

export function ProfilePage({ user }: { user: StaffUser }) {
  const [tab, setTab] = useState(0);
  const [email, setEmail] = useState(user.email);
  const [emailPassword, setEmailPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [otpPassword, setOtpPassword] = useState("");
  const [confirmRegeneration, setConfirmRegeneration] = useState(false);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [otpError, setOtpError] = useState("");
  const [otpSuccess, setOtpSuccess] = useState("");
  const [otpBusy, setOtpBusy] = useState(false);

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (!meetsPasswordPolicy(newPassword)) {
      setPasswordError(passwordPolicyError);
      return;
    }
    if (newPassword !== confirmation) {
      setPasswordError("Die neuen Passwörter stimmen nicht überein.");
      return;
    }
    if (newPassword === currentPassword) {
      setPasswordError("Das neue Passwort muss sich vom aktuellen Passwort unterscheiden.");
      return;
    }

    setPasswordBusy(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });
      if (result.error) {
        setPasswordError("Das Passwort konnte nicht geändert werden. Prüfen Sie Ihr aktuelles Passwort.");
        return;
      }

      setCurrentPassword("");
      setNewPassword("");
      setConfirmation("");
      setPasswordSuccess("Passwort geändert. Andere aktive Sitzungen wurden abgemeldet.");
    } catch {
      setPasswordError("Das Passwort konnte nicht geändert werden. Bitte versuchen Sie es erneut.");
    } finally {
      setPasswordBusy(false);
    }
  }

  async function changeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError("");
    setEmailSuccess("");
    setEmailBusy(true);
    try {
      const response = await fetch("/api/admin/profile/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, currentPassword: emailPassword }),
      });
      const payload = await response.json() as { data?: { email?: string }; error?: { message?: string } };
      if (!response.ok || !payload.data?.email) {
        setEmailError(payload.error?.message ?? "Die E-Mail-Adresse konnte nicht geändert werden.");
        return;
      }
      setEmail(payload.data.email);
      setEmailPassword("");
      setEmailSuccess("E-Mail-Adresse geändert. Andere aktive Sitzungen wurden abgemeldet.");
    } catch {
      setEmailError("Die E-Mail-Adresse konnte nicht geändert werden. Bitte versuchen Sie es erneut.");
    } finally {
      setEmailBusy(false);
    }
  }

  async function regenerateRecoveryCodes(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOtpError("");
    setOtpSuccess("");
    if (!confirmRegeneration) {
      setOtpError("Bestätigen Sie zuerst, dass bisherige Wiederherstellungscodes ungültig werden.");
      return;
    }

    setOtpBusy(true);
    try {
      const result = await authClient.twoFactor.generateBackupCodes({ password: otpPassword });
      if (result.error || !result.data?.backupCodes?.length) {
        setOtpError("Wiederherstellungscodes konnten nicht neu erstellt werden. Prüfen Sie Ihr aktuelles Passwort.");
        return;
      }
      setRecoveryCodes(result.data.backupCodes);
      setOtpPassword("");
      setConfirmRegeneration(false);
      setOtpSuccess("Neue Wiederherstellungscodes erstellt. Alte Codes sind ab jetzt ungültig.");
    } catch {
      setOtpError("Wiederherstellungscodes konnten nicht neu erstellt werden.");
    } finally {
      setOtpBusy(false);
    }
  }

  function downloadRecoveryCodes() {
    if (recoveryCodes.length === 0) return;
    const content = [
      "Vega – Wiederherstellungscodes",
      "Jeder Code ist einmalig. Bewahren Sie diese Datei sicher auf.",
      "",
      ...recoveryCodes,
      "",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `vega-wiederherstellungscodes-${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  return (
    <Stack spacing={3} sx={{ maxWidth: 720 }}>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
        <Stack spacing={2}>
          <Typography component="h1" variant="h4">Mein Profil</Typography>
          <Tabs value={tab} onChange={(_, value: number) => setTab(value)} aria-label="Profil-Einstellungen">
            <Tab label="Profil" id="profile-tab-0" aria-controls="profile-panel-0" />
            <Tab label="Passwort" id="profile-tab-1" aria-controls="profile-panel-1" />
            <Tab label="OTP-Einstellungen" id="profile-tab-2" aria-controls="profile-panel-2" />
          </Tabs>
          <Divider />

          <Box role="tabpanel" id="profile-panel-0" aria-labelledby="profile-tab-0" hidden={tab !== 0}>
            {tab === 0 && (
              <Stack spacing={2} sx={{ pt: 1 }}>
                <TextField label="Name" value={user.name} slotProps={{ htmlInput: { readOnly: true } }} />
                <Box component="form" onSubmit={changeEmail}>
                  <Stack spacing={2}>
                    <Typography color="text.secondary">
                      Für die Änderung Ihrer Anmelde- und Reset-E-Mail-Adresse bestätigen Sie Ihr aktuelles Passwort. Andere aktive Sitzungen werden abgemeldet.
                    </Typography>
                    {emailError && <Alert severity="error">{emailError}</Alert>}
                    {emailSuccess && <Alert severity="success">{emailSuccess}</Alert>}
                    <TextField autoComplete="email" label="E-Mail-Adresse" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
                    <PasswordField autoComplete="current-password" label="Aktuelles Passwort bestätigen" value={emailPassword} onChange={setEmailPassword} />
                    <Button type="submit" variant="contained" disabled={emailBusy}>
                      {emailBusy ? <CircularProgress size={22} color="inherit" /> : "E-Mail-Adresse ändern"}
                    </Button>
                  </Stack>
                </Box>
                <TextField label="Rolle" value={user.role} slotProps={{ htmlInput: { readOnly: true } }} />
                <Typography variant="body2" color="text.secondary">
                  Sitzungen laufen spätestens 30 Tage nach der Anmeldung ab.
                </Typography>
              </Stack>
            )}
          </Box>

          <Box role="tabpanel" id="profile-panel-1" aria-labelledby="profile-tab-1" hidden={tab !== 1}>
            {tab === 1 && (
              <Stack spacing={2} sx={{ pt: 1 }}>
                <Typography color="text.secondary">
                  Das neue Passwort benötigt mindestens 8 Zeichen, einen Großbuchstaben, einen Kleinbuchstaben und eine Zahl.
                  Andere aktive Sitzungen werden nach der Änderung abgemeldet.
                </Typography>
                {passwordError && <Alert severity="error">{passwordError}</Alert>}
                {passwordSuccess && <Alert severity="success">{passwordSuccess}</Alert>}
                <Box component="form" onSubmit={changePassword}>
                  <Stack spacing={2}>
                    <PasswordField autoComplete="current-password" label="Aktuelles Passwort" value={currentPassword} onChange={setCurrentPassword} />
                    <PasswordField
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
                    <Button type="submit" variant="contained" disabled={passwordBusy}>
                      {passwordBusy ? <CircularProgress size={22} color="inherit" /> : "Passwort ändern"}
                    </Button>
                  </Stack>
                </Box>
              </Stack>
            )}
          </Box>

          <Box role="tabpanel" id="profile-panel-2" aria-labelledby="profile-tab-2" hidden={tab !== 2}>
            {tab === 2 && (
              <Stack spacing={2} sx={{ pt: 1 }}>
                <Alert severity={user.twoFactorEnabled ? "success" : "warning"}>
                  TOTP-Authentifizierung: {user.twoFactorEnabled ? "aktiv" : "nicht eingerichtet"}
                </Alert>
                <Typography color="text.secondary">
                  Wiederherstellungscodes sind einmalig. Beim Erzeugen neuer Codes werden alle bisherigen Codes ungültig.
                  Die erzeugten Codes werden nur in diesem Browser angezeigt und nicht dauerhaft in der App gespeichert.
                </Typography>
                {otpError && <Alert severity="error">{otpError}</Alert>}
                {otpSuccess && <Alert severity="success">{otpSuccess}</Alert>}
                {recoveryCodes.length > 0 && (
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Stack spacing={1}>
                      {recoveryCodes.map((recoveryCode) => (
                        <Typography key={recoveryCode} component="code" align="center">{recoveryCode}</Typography>
                      ))}
                    </Stack>
                  </Paper>
                )}
                <Box component="form" onSubmit={regenerateRecoveryCodes}>
                  <Stack spacing={2}>
                    <PasswordField autoComplete="current-password" label="Aktuelles Passwort bestätigen" value={otpPassword} onChange={setOtpPassword} />
                    <FormControlLabel
                      control={(
                        <Checkbox
                          checked={confirmRegeneration}
                          onChange={(event) => setConfirmRegeneration(event.target.checked)}
                        />
                      )}
                      label="Ich verstehe, dass meine bisherigen Wiederherstellungscodes ungültig werden."
                    />
                    <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                      <Button type="submit" variant="contained" disabled={otpBusy || !user.twoFactorEnabled}>
                        {otpBusy ? <CircularProgress size={22} color="inherit" /> : "Codes neu erzeugen"}
                      </Button>
                      <Button
                        type="button"
                        variant="outlined"
                        onClick={downloadRecoveryCodes}
                        disabled={recoveryCodes.length === 0}
                      >
                        Codes herunterladen
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              </Stack>
            )}
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}
