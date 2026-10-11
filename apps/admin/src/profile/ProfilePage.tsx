import { useState, type FormEvent } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import { authClient } from "../auth-client.js";
import { meetsPasswordPolicy, passwordPolicyError } from "../password-policy.js";
import type { StaffUser } from "../types.js";
import { PasswordField } from "../auth/PasswordField.js";

export function ProfileSubmitButton({ label, busy, disabled = false }: { label: string; busy: boolean; disabled?: boolean }) {
  return (
    <Button type="submit" variant="contained" disabled={busy || disabled} aria-label={label} sx={{ alignSelf: "flex-end", display: "inline-grid", width: "max-content", maxWidth: "100%" }}>
      <Box component="span" aria-hidden="true" sx={{ gridArea: "1 / 1", visibility: "hidden" }}>E-Mail-Adresse ändern</Box>
      <Box component="span" sx={{ gridArea: "1 / 1", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {busy ? <CircularProgress size={22} color="inherit" /> : label}
      </Box>
    </Button>
  );
}

export function RecoveryCodesPanel({ codes, onDownload }: { codes: string[]; onDownload: () => void }) {
  if (codes.length === 0) return null;
  return (
    <Box sx={{ p: 2, bgcolor: "background.default" }}>
      <Stack spacing={1}>
        <Stack direction="row" sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Typography component="h3" variant="subtitle2">Wiederherstellungscodes</Typography>
          <Tooltip title="Codes herunterladen">
            <IconButton type="button" onClick={onDownload} aria-label="Codes herunterladen">
              <FileDownloadOutlined />
            </IconButton>
          </Tooltip>
        </Stack>
        {codes.map((code) => (
          <Typography key={code} component="code" align="center">{code}</Typography>
        ))}
      </Stack>
    </Box>
  );
}

export function ProfilePage({ user }: { user: StaffUser }) {
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
    <Stack spacing={2} sx={{ width: "100%", maxWidth: 760, mx: "auto" }}>
      <Paper component="section" aria-labelledby="profile-heading" variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={1.5}>
          <Typography component="h2" variant="h6" id="profile-heading">Profil</Typography>
          <Box component="dl" sx={{ m: 0 }}>
            <Typography component="dt" variant="body2" color="text.secondary">Name</Typography>
            <Typography component="dd" sx={{ m: 0 }}>{user.name}</Typography>
          </Box>
          <Box component="dl" sx={{ m: 0 }}>
            <Typography component="dt" variant="body2" color="text.secondary">Rolle</Typography>
            <Typography component="dd" sx={{ m: 0 }}>{user.role}</Typography>
          </Box>
          <Box component="form" onSubmit={changeEmail}>
            <Stack spacing={2}>
              <Typography variant="body2" color="text.secondary">
                Für die Änderung Ihrer Anmelde- und Reset-E-Mail-Adresse bestätigen Sie Ihr aktuelles Passwort. Andere aktive Sitzungen werden abgemeldet.
              </Typography>
              {emailError && <Alert severity="error">{emailError}</Alert>}
              {emailSuccess && <Alert severity="success">{emailSuccess}</Alert>}
              <TextField autoComplete="email" label="E-Mail-Adresse" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
              <PasswordField autoComplete="current-password" label="Aktuelles Passwort bestätigen" value={emailPassword} onChange={setEmailPassword} />
              <ProfileSubmitButton label="E-Mail-Adresse ändern" busy={emailBusy} />
            </Stack>
          </Box>
          <Typography variant="body2" color="text.secondary">
            Sitzungen laufen spätestens 30 Tage nach der Anmeldung ab.
          </Typography>
        </Stack>
      </Paper>
      <Paper component="section" aria-labelledby="password-heading" variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={1.5}>
          <Typography component="h2" variant="h6" id="password-heading">Passwort</Typography>
          <Typography variant="body2" color="text.secondary">
            Das neue Passwort benötigt mindestens 8 Zeichen, einen Großbuchstaben, einen Kleinbuchstaben und eine Zahl.
            Andere aktive Sitzungen werden nach der Änderung abgemeldet.
          </Typography>
          {passwordError && <Alert severity="error">{passwordError}</Alert>}
          {passwordSuccess && <Alert severity="success">{passwordSuccess}</Alert>}
          <Box component="form" onSubmit={changePassword}>
            <Stack spacing={2}>
              <PasswordField autoComplete="current-password" label="Aktuelles Passwort" value={currentPassword} onChange={setCurrentPassword} />
              <Stack sx={{ pt: 1 }}>
                <PasswordField
                  autoComplete="new-password"
                  label="Neues Passwort"
                  value={newPassword}
                  onChange={setNewPassword}
                  minLength={8}
                  maxLength={128}
                />
              </Stack>
              <PasswordField
                autoComplete="new-password"
                label="Neues Passwort wiederholen"
                value={confirmation}
                onChange={setConfirmation}
                minLength={8}
                maxLength={128}
              />
              <ProfileSubmitButton label="Passwort ändern" busy={passwordBusy} />
            </Stack>
          </Box>
        </Stack>
      </Paper>
      <Paper component="section" aria-labelledby="otp-heading" variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={1.5}>
          <Typography component="h2" variant="h6" id="otp-heading">OTP-Einstellungen</Typography>
          <Alert severity={user.twoFactorEnabled ? "success" : "warning"}>
            TOTP-Authentifizierung: {user.twoFactorEnabled ? "aktiv" : "nicht eingerichtet"}
          </Alert>
          <Typography variant="body2" color="text.secondary">
            Wiederherstellungscodes sind einmalig. Beim Erzeugen neuer Codes werden alle bisherigen Codes ungültig.
            Die erzeugten Codes werden nur in diesem Browser angezeigt und nicht dauerhaft in der App gespeichert.
          </Typography>
          {otpError && <Alert severity="error">{otpError}</Alert>}
          {otpSuccess && <Alert severity="success">{otpSuccess}</Alert>}
          <RecoveryCodesPanel codes={recoveryCodes} onDownload={downloadRecoveryCodes} />
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
              <ProfileSubmitButton label="Codes neu erzeugen" busy={otpBusy} disabled={!user.twoFactorEnabled} />
            </Stack>
          </Box>
        </Stack>
      </Paper>
    </Stack>
  );
}
