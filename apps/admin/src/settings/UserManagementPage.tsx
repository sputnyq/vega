import { useEffect, useState } from "react";
import { Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Menu, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from "@mui/material";
import { AdminAlert as Alert } from "../components/AdminNotifications.js";
import MoreVert from "@mui/icons-material/MoreVert";
import AddOutlined from "@mui/icons-material/AddOutlined";
import type { StaffAccountDto, UserRole } from "@vega/domain";
import { PasswordField } from "../auth/PasswordField.js";
import { apiRequest } from "../api/api-request.js";
import { isTotpRequired } from "@vega/domain";

type Action = { kind: "role"; role: UserRole } | { kind: "block"; blocked: boolean } | { kind: "reset-totp" } | { kind: "reset-password" };
type Pending = { type: "create" } | { type: "action"; user: StaffAccountDto; action: Action };
const labels = { role: "Rolle ändern", block: "Kontosperre ändern", "reset-totp": "Authenticator zurücksetzen", "reset-password": "Passwort-Reset-Mail senden" };

export function StaffAccountStatus({ blocked }: { blocked: boolean }) {
  const label = blocked ? "Gesperrt" : "Aktiv";
  return (
    <Chip size="small" label={label} color={blocked ? "error" : "success"} sx={{ width: "fit-content" }} />
  );
}

export function staffAccountActions(user: Pick<StaffAccountDto, "id" | "role" | "blocked">, currentUserId: string): { label: string; action: Action; disabled: boolean }[] {
  const ownAccount = user.id === currentUserId;
  const nextRole = user.role === "Admin" ? "Kundenberater" : "Admin";
  return [
    { label: `Als ${nextRole} setzen`, action: { kind: "role", role: nextRole }, disabled: ownAccount },
    { label: user.blocked ? "Entsperren" : "Sperren", action: { kind: "block", blocked: !user.blocked }, disabled: ownAccount },
    { label: "Passwort-Reset-Mail", action: { kind: "reset-password" }, disabled: false },
    { label: "2FA zurücksetzen", action: { kind: "reset-totp" }, disabled: ownAccount },
  ];
}

export async function loadStaffAccounts(): Promise<StaffAccountDto[]> {
  const items: StaffAccountDto[] = [];
  for (let page = 1; ; page += 1) {
    const result = await apiRequest<{ items: StaffAccountDto[]; total: number }>(page === 1 ? "/api/admin/staff" : `/api/admin/staff?page=${page}`);
    items.push(...result.items);
    if (items.length >= result.total) return items;
    if (result.items.length === 0) throw new Error("Konten konnten nicht vollständig geladen werden.");
  }
}

export function UserManagementPage({ currentUserId }: { currentUserId: string }) {
  const [items, setItems] = useState<StaffAccountDto[]>([]);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
  const [actionMenu, setActionMenu] = useState<{ anchor: HTMLElement; user: StaffAccountDto } | null>(null);
  const [password, setPassword] = useState("");
  const [initialPassword, setInitialPassword] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<UserRole>("Kundenberater");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    void loadStaffAccounts()
      .then((result) => { if (active) setItems(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Konten konnten nicht geladen werden."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  const open = (value: Pending) => {
    setPassword(""); setInitialPassword(""); setName(""); setEmail(""); setRole("Kundenberater"); setActionError(""); setPending(value);
  };
  const close = () => {
    if (busy) return;
    setPending(null); setPassword(""); setInitialPassword(""); setActionError("");
  };
  async function execute() {
    if (!pending || busy) return;
    setBusy(true); setActionError(""); setMessage("");
    try {
      if (pending.type === "create") {
        await apiRequest("/api/admin/staff", "POST", { name, email, role, initialPassword, currentPassword: password });
        setMessage("Konto angelegt.");
      } else {
        await apiRequest(`/api/admin/staff/${encodeURIComponent(pending.user.id)}/actions`, "POST", { ...pending.action, currentPassword: password });
        setMessage(pending.action.kind === "reset-password" ? "Reset-Mail versendet."
          : pending.action.kind === "reset-totp" ? "TOTP zurückgesetzt."
          : "Konto aktualisiert.");
      }
      setPending(null); setPassword(""); setInitialPassword(""); setReload((value) => value + 1);
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : "Die Aktion konnte nicht ausgeführt werden."); setPassword(""); }
    finally { setBusy(false); }
  }
  return <Stack spacing={2}>
    {error && <Alert severity="error">{error}</Alert>}{message && <Alert severity="success">{message}</Alert>}
    <Stack direction="row" sx={{ justifyContent: "flex-end" }}>
      <Button variant="contained" startIcon={<AddOutlined />} onClick={() => open({ type: "create" })}>Nutzer anlegen</Button>
    </Stack>
    {loading ? <Alert severity="info">Konten werden geladen …</Alert> : <TableContainer component={Paper} variant="outlined"><Table size="small">
      <TableHead><TableRow><TableCell align="center">Status</TableCell><TableCell>Name</TableCell><TableCell>E-Mail</TableCell><TableCell>Rolle</TableCell><TableCell>OTP</TableCell><TableCell>Aktionen</TableCell></TableRow></TableHead>
      <TableBody>{items.map((user) => <TableRow key={user.id}>
        <TableCell align="center"><StaffAccountStatus blocked={user.blocked} /></TableCell>
        <TableCell>{user.name}</TableCell>
        <TableCell>{user.email}</TableCell>
        <TableCell>{user.role}</TableCell>
        <TableCell><Stack spacing={0.5} sx={{ alignItems: "flex-start" }}>
          {user.mustChangePassword && <Chip size="small" label="Passwortwechsel erforderlich" />}
          <Chip size="small" label={user.twoFactorEnabled ? "TOTP eingerichtet" : isTotpRequired(user.role) ? "TOTP erforderlich" : "Ohne TOTP"} /></Stack></TableCell>
        <TableCell>
          <Tooltip title="Kontoaktionen">
            <IconButton size="small" id={`staff-actions-${user.id}`} aria-label={`Aktionen für ${user.name}`} aria-haspopup="menu" aria-controls={actionMenu?.user.id === user.id ? "staff-actions-menu" : undefined} aria-expanded={actionMenu?.user.id === user.id ? true : undefined} onClick={(event) => setActionMenu({ anchor: event.currentTarget, user })}>
              <MoreVert />
            </IconButton>
          </Tooltip>
        </TableCell>
      </TableRow>)}</TableBody>
    </Table>{items.length === 0 && <Typography sx={{ p: 2 }}>Keine Mitarbeiterkonten gefunden.</Typography>}</TableContainer>}
    <Menu id="staff-actions-menu" anchorEl={actionMenu?.anchor ?? null} open={actionMenu !== null} onClose={() => setActionMenu(null)} slotProps={{ list: { "aria-labelledby": actionMenu ? `staff-actions-${actionMenu.user.id}` : undefined } }}>
      {actionMenu && staffAccountActions(actionMenu.user, currentUserId).map(({ label, action, disabled }) => (
        <MenuItem key={action.kind} disabled={disabled} onClick={() => { const user = actionMenu.user; setActionMenu(null); open({ type: "action", user, action }); }}>{label}</MenuItem>
      ))}
    </Menu>
    <Dialog open={pending !== null} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>{pending?.type === "create" ? "Nutzer anlegen" : pending ? labels[pending.action.kind] : ""}</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        {actionError && <Alert severity="error">{actionError}</Alert>}
        {pending?.type === "create" ? <>
          <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} slotProps={{ htmlInput: { maxLength: 191 } }} />
          <TextField label="E-Mail" type="email" value={email} onChange={(event) => setEmail(event.target.value)} slotProps={{ htmlInput: { maxLength: 254 } }} />
          <TextField select label="Rolle" value={role} onChange={(event) => { if (event.target.value === "Admin" || event.target.value === "Kundenberater") setRole(event.target.value); }}>
            <MenuItem value="Kundenberater">Kundenberater</MenuItem><MenuItem value="Admin">Admin</MenuItem>
          </TextField>
          <PasswordField label="Initialpasswort des Mitarbeiters" autoComplete="new-password" value={initialPassword} onChange={setInitialPassword} minLength={8} maxLength={128} helperText="Mindestens 8 Zeichen, Groß-/Kleinbuchstabe und Zahl. Nicht per E-Mail versenden." />
        </> : pending && <>
          <Typography>{pending.user.name} · {pending.user.email}</Typography>
          {pending.action.kind === "role" && <Alert severity="warning">Neue Rolle: {pending.action.role}</Alert>}
          {pending.action.kind === "reset-totp" && <Alert severity="warning">Authenticator, Recovery-Codes und alle Sitzungen werden widerrufen. Identität vorab außerhalb dieses Dialogs prüfen.</Alert>}
        </>}
        <PasswordField label="Ihr aktuelles Admin-Passwort" autoComplete="current-password" value={password} onChange={setPassword} maxLength={128} />
      </Stack></DialogContent>
      <DialogActions><Button disabled={busy} onClick={close}>Abbrechen</Button><Button variant="contained" disabled={busy || !password || (pending?.type === "create" && (!name || !email || !initialPassword))} onClick={() => void execute()}>{busy ? "Wird ausgeführt …" : "Bestätigen"}</Button></DialogActions>
    </Dialog>
  </Stack>;
}
