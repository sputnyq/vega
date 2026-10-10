import { useEffect, useState } from "react";
import { Alert, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Pagination, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import type { StaffAccountDto, UserRole } from "@vega/domain";
import { PasswordField } from "../auth/PasswordField.js";
import { apiRequest } from "../api/api-request.js";

type Action = { kind: "role"; role: UserRole } | { kind: "block"; blocked: boolean } | { kind: "reset-totp" } | { kind: "reset-password" };
type Pending = { type: "create" } | { type: "action"; user: StaffAccountDto; action: Action };
const labels = { role: "Rolle ändern", block: "Kontosperre ändern", "reset-totp": "Authenticator zurücksetzen", "reset-password": "Passwort-Reset-Mail senden" };

export function UserManagementPage({ currentUserId }: { currentUserId: string }) {
  const [items, setItems] = useState<StaffAccountDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState<Pending | null>(null);
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
    void apiRequest<{ items: StaffAccountDto[]; total: number }>(`/api/admin/staff?page=${page}&search=${encodeURIComponent(query)}`)
      .then((result) => { if (active) { setItems(result.items); setTotal(result.total); } })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Konten konnten nicht geladen werden."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page, query, reload]);
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
        setMessage("Konto angelegt. Initialpasswort separat sicher übergeben; vor Zugriff sind Passwortwechsel und TOTP erforderlich.");
      } else {
        await apiRequest(`/api/admin/staff/${encodeURIComponent(pending.user.id)}/actions`, "POST", { ...pending.action, currentPassword: password });
        setMessage(pending.action.kind === "reset-password" ? "Passwort-Reset-Mail versendet."
          : pending.action.kind === "reset-totp" ? "Authenticator und Recovery-Codes gelöscht. Neue Anmeldung und TOTP-Einrichtung erforderlich."
          : "Konto aktualisiert. Bestehende Sitzungen wurden widerrufen.");
      }
      setPending(null); setPassword(""); setInitialPassword(""); setReload((value) => value + 1);
    } catch (reason) { setActionError(reason instanceof Error ? reason.message : "Die Aktion konnte nicht ausgeführt werden."); setPassword(""); }
    finally { setBusy(false); }
  }
  return <Stack spacing={2}>
    <Typography component="h1" variant="h5">Mitarbeiterverwaltung</Typography>
    <Alert severity="info">Jede Kontoaktion erfordert Ihr aktuelles Admin-Passwort. Der 2FA-Reset ist nur nach separat geprüfter Identität des Mitarbeiters auszuführen. Das eigene Konto kann hier nicht gesperrt, herabgestuft oder per 2FA-Reset zurückgesetzt werden.</Alert>
    {error && <Alert severity="error">{error}</Alert>}{message && <Alert severity="success">{message}</Alert>}
    <Stack direction={{ xs: "column", sm: "row" }} spacing={2} component="form" onSubmit={(event) => { event.preventDefault(); setPage(1); setQuery(search.trim()); }}>
      <TextField label="Name oder E-Mail suchen" value={search} onChange={(event) => setSearch(event.target.value)} />
      <Button type="submit">Suchen</Button><Button variant="contained" onClick={() => open({ type: "create" })}>Konto anlegen</Button>
      <Button onClick={() => setReload((value) => value + 1)}>Neu laden</Button>
    </Stack>
    {loading ? <Alert severity="info">Konten werden geladen …</Alert> : <TableContainer component={Paper} variant="outlined"><Table size="small">
      <TableHead><TableRow><TableCell>Name / E-Mail</TableCell><TableCell>Rolle</TableCell><TableCell>Status</TableCell><TableCell>Aktionen</TableCell></TableRow></TableHead>
      <TableBody>{items.map((user) => <TableRow key={user.id}>
        <TableCell>{user.name}<Typography variant="body2" color="text.secondary">{user.email}</Typography></TableCell>
        <TableCell>{user.role}</TableCell>
        <TableCell><Stack spacing={0.5}><Chip size="small" label={user.blocked ? "Gesperrt" : "Aktiv"} color={user.blocked ? "error" : "success"} />
          {user.mustChangePassword && <Chip size="small" label="Passwortwechsel erforderlich" />}
          <Chip size="small" label={user.twoFactorEnabled ? "TOTP eingerichtet" : "TOTP erforderlich"} /></Stack></TableCell>
        <TableCell><Stack spacing={0.5}>
          <Button size="small" disabled={user.id === currentUserId} onClick={() => open({ type: "action", user, action: { kind: "role", role: user.role === "Admin" ? "Kundenberater" : "Admin" } })}>Als {user.role === "Admin" ? "Kundenberater" : "Admin"} setzen</Button>
          <Button size="small" disabled={user.id === currentUserId} onClick={() => open({ type: "action", user, action: { kind: "block", blocked: !user.blocked } })}>{user.blocked ? "Entsperren" : "Sperren"}</Button>
          <Button size="small" onClick={() => open({ type: "action", user, action: { kind: "reset-password" } })}>Passwort-Reset-Mail</Button>
          <Button size="small" disabled={user.id === currentUserId} onClick={() => open({ type: "action", user, action: { kind: "reset-totp" } })}>2FA zurücksetzen</Button>
        </Stack></TableCell>
      </TableRow>)}</TableBody>
    </Table>{items.length === 0 && <Typography sx={{ p: 2 }}>Keine Mitarbeiterkonten gefunden.</Typography>}</TableContainer>}
    <Pagination count={Math.max(1, Math.ceil(total / 25))} page={page} onChange={(_, value) => setPage(value)} />
    <Dialog open={pending !== null} onClose={close} fullWidth maxWidth="sm">
      <DialogTitle>{pending?.type === "create" ? "Mitarbeiterkonto anlegen" : pending ? labels[pending.action.kind] : ""}</DialogTitle>
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
