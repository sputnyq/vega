import { lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from "react";
import { Box, Button, Chip, IconButton, Paper, Stack, Tab, Tabs, TextField, Tooltip, Typography } from "@mui/material";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import { formatGermanDate, MAX_REMINDER_LEVEL, type AdminCreditNoteDto, type AdminReminderDto, type CreditNoteInput, type ReminderInput } from "@vega/domain";
import { apiRequest } from "../api/api-request.js";
import { useAdminNotification } from "../components/AdminNotifications.js";
import type { EmailTarget } from "../email/EmailDialog.js";

const EmailDialog = lazy(() => import("../email/EmailDialog.js").then((module) => ({ default: module.EmailDialog })));

type AccountingTab = "invoice" | "credit" | number;

/** Saved invoice with legacy tabs: Rechnung, 1.–3. Mahnung and Gutschrift. */
export function InvoiceAccountingTabs({ invoiceId, disabled, invoiceForm }: { invoiceId: string; disabled: boolean; invoiceForm: ReactNode }) {
  const notify = useAdminNotification();
  const [tab, setTab] = useState<AccountingTab>("invoice");
  const [emailTarget, setEmailTarget] = useState<EmailTarget | null>(null);
  const [reminders, setReminders] = useState<AdminReminderDto[]>();
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => apiRequest<{ items: AdminReminderDto[] }>(`/api/admin/reminders?invoiceId=${encodeURIComponent(invoiceId)}`).then(({ items }) => setReminders(items.filter((item) => !item.archivedAt))).catch((error: Error) => notify("error", error.message)), [invoiceId, notify]);
  useEffect(() => { void load(); }, [load]);
  async function run(action: () => Promise<unknown>, message: string, nextTab?: AccountingTab) {
    setBusy(true);
    try { await action(); notify("success", message); await load(); if (nextTab !== undefined) setTab(nextTab); } catch (error) { notify("error", (error as Error).message); } finally { setBusy(false); }
  }
  const highest = reminders?.at(-1)?.level ?? 0;
  const nextLevel = highest + 1;
  const locked = disabled || busy;
  const levels = reminders ? [...reminders.map((reminder) => reminder.level), ...(nextLevel <= MAX_REMINDER_LEVEL ? [nextLevel] : [])] : [];
  return <Stack spacing={2}>
    <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
      <Tabs value={tab} onChange={(_, next: AccountingTab) => setTab(next)} variant="scrollable" allowScrollButtonsMobile>
        <Tab value="invoice" label="Rechnung" />
        {levels.map((level) => <Tab key={level} value={level} label={level === nextLevel ? `+ ${level}. Mahnung` : `${level}. Mahnung`} />)}
        <Tab value="credit" label="Gutschrift" />
      </Tabs>
    </Box>
    {/* The invoice form stays mounted so the toolbar save button (form="invoice-editor-form") keeps working. */}
    <Box hidden={tab !== "invoice"}>{invoiceForm}</Box>
    {reminders?.map((reminder) => <Box key={reminder.id} hidden={tab !== reminder.level}><ReminderCard reminder={reminder} disabled={locked}
      onDelete={reminder.level === highest ? () => {
        if (!window.confirm(`${reminder.level}. Mahnung endgültig löschen?`)) return;
        void run(() => apiRequest(`/api/admin/reminders/${reminder.id}`, "DELETE"), "Mahnung gelöscht.", reminder.level > 1 ? reminder.level - 1 : "invoice");
      } : undefined}
      onSave={(input) => void run(() => apiRequest(`/api/admin/reminders/${reminder.id}`, "PUT", input), "Mahnung gespeichert.")}
      onEmail={() => setEmailTarget({ type: "reminder", id: reminder.id, level: reminder.level })} /></Box>)}
    {tab === nextLevel && nextLevel <= MAX_REMINDER_LEVEL && <Panel>
      <Typography variant="body2" color="text.secondary">Die {nextLevel}. Mahnung ist noch nicht angelegt. Fälligkeit, Gebühr, Betrag und Text werden vorbelegt und können danach angepasst werden.</Typography>
      <Button variant="contained" sx={{ alignSelf: "flex-start" }} disabled={locked} onClick={() => void run(() => apiRequest("/api/admin/reminders", "POST", { invoiceId, level: nextLevel }), `${nextLevel}. Mahnung angelegt.`)}>{nextLevel}. Mahnung anlegen</Button>
    </Panel>}
    <Box hidden={tab !== "credit"}><CreditNoteSection invoiceId={invoiceId} disabled={disabled} onEmail={setEmailTarget} /></Box>
    {emailTarget && <Suspense fallback={null}><EmailDialog target={emailTarget} onClose={() => setEmailTarget(null)} onSent={() => void load()} /></Suspense>}
  </Stack>;
}

export function previousDueLabel(level: number, previousDueDate: string): string {
  return `${level === 1 ? "Rechnung" : `${level - 1}. Mahnung`} ist fällig am ${formatGermanDate(previousDueDate)}`;
}

function ReminderCard({ reminder, disabled, onSave, onEmail, onDelete }: { reminder: AdminReminderDto; disabled: boolean; onSave: (input: ReminderInput) => void; onEmail: () => void; onDelete?: (() => void) | undefined }) {
  const [value, setValue] = useState<ReminderInput>(reminder);
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setValue(reminder); setDirty(false); }, [reminder]);
  function change<K extends keyof ReminderInput>(key: K, next: ReminderInput[K]) { setValue((current) => ({ ...current, [key]: next })); setDirty(true); }
  const overdue = reminder.previousDueDate < new Date().toISOString().slice(0, 10);
  return <Panel>
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>{reminder.level}. Mahnung</Typography>
      {reminder.sentAt && <Chip size="small" color="success" label={`Versendet am ${formatGermanDate(reminder.sentAt)}`} />}
    </Stack>
    <Typography variant="body2" sx={{ color: overdue ? "error.main" : "success.main" }}>{previousDueLabel(reminder.level, reminder.previousDueDate)}</Typography>
    <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
      <TextField label="Fälligkeitsdatum der Mahnung" type="date" value={value.dueDate} onChange={(e) => change("dueDate", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
      <TextField label="Mahngebühr" type="number" value={value.fee} onChange={(e) => change("fee", Number(e.target.value))} />
      <TextField label="Offener Betrag aus der Rechnung" type="number" value={value.outstandingAmount} onChange={(e) => change("outstandingAmount", Number(e.target.value))} />
    </Stack>
    <TextField label="Text" helperText="Fälligkeitsdatum auch im Text anpassen." multiline minRows={6} value={value.text} onChange={(e) => change("text", e.target.value)} />
    <DocumentActions disabled={disabled} dirty={dirty} pdfHref={`/api/admin/reminders/${reminder.id}/pdf`} onSave={() => onSave(value)} onEmail={onEmail} onDelete={onDelete} />
  </Panel>;
}

const emptyCredit = (): CreditNoteInput => ({ creditNumber: "", creditDate: new Date().toISOString().slice(0, 10), text: "", entries: [] });

function CreditNoteSection({ invoiceId, disabled, onEmail }: { invoiceId: string; disabled: boolean; onEmail: (target: EmailTarget) => void }) {
  const notify = useAdminNotification();
  const [credit, setCredit] = useState<AdminCreditNoteDto | null>();
  const [draft, setDraft] = useState<CreditNoteInput>();
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const apply = useCallback((loaded: AdminCreditNoteDto | null) => { setCredit(loaded); setDraft(loaded ?? undefined); setDirty(false); }, []);
  useEffect(() => {
    apiRequest<{ items: AdminCreditNoteDto[] }>(`/api/admin/credits?invoiceId=${encodeURIComponent(invoiceId)}`).then(({ items }) => apply(items[0] ?? null)).catch((error: Error) => notify("error", error.message));
  }, [apply, invoiceId, notify]);
  async function run(action: () => Promise<AdminCreditNoteDto>, message: string) {
    setBusy(true);
    try { apply(await action()); notify("success", message); } catch (error) { notify("error", (error as Error).message); } finally { setBusy(false); }
  }
  function change<K extends keyof CreditNoteInput>(key: K, next: CreditNoteInput[K]) { setDraft((current) => current && { ...current, [key]: next }); setDirty(true); }
  function save() {
    if (!draft) return;
    void run(() => credit ? apiRequest(`/api/admin/credits/${credit.id}`, "PUT", draft) : apiRequest("/api/admin/credits", "POST", { ...draft, invoiceId }), "Gutschrift gespeichert.");
  }
  const locked = disabled || busy;
  if (credit === undefined) return <Panel>{null}</Panel>;
  if (credit?.archivedAt) {
    return <Panel><ArchivedRow label={`Gutschrift ${credit.creditNumber} (archiviert)`} disabled={locked} onRestore={() => void run(() => apiRequest(`/api/admin/credits/${credit.id}/restore`, "POST"), "Gutschrift wiederhergestellt.")} /></Panel>;
  }
  if (!draft) return <Panel><Button sx={{ alignSelf: "flex-start" }} disabled={locked} onClick={() => { setDraft(emptyCredit()); setDirty(true); }}>Gutschrift anlegen</Button></Panel>;
  return <Panel>
    <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
      <TextField label="Gutschriftnummer" required value={draft.creditNumber} onChange={(e) => change("creditNumber", e.target.value)} />
      <TextField label="Gutschriftdatum" type="date" required value={draft.creditDate} onChange={(e) => change("creditDate", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
    </Stack>
    {draft.entries.map((entry, index) => <Stack key={index} direction={{ xs: "column", md: "row" }} spacing={1}>
      <TextField label="Beschreibung" value={entry.description} onChange={(e) => change("entries", draft.entries.map((item, i) => i === index ? { ...item, description: e.target.value } : item))} fullWidth />
      <TextField label="Menge" type="number" value={entry.quantity} onChange={(e) => change("entries", draft.entries.map((item, i) => i === index ? { ...item, quantity: Number(e.target.value) } : item))} />
      <TextField label="Einzelpreis" type="number" value={entry.unitPrice} onChange={(e) => change("entries", draft.entries.map((item, i) => i === index ? { ...item, unitPrice: Number(e.target.value) } : item))} />
      <IconButton aria-label="Position entfernen" onClick={() => change("entries", draft.entries.filter((_, i) => i !== index))}><DeleteOutlined /></IconButton>
    </Stack>)}
    <Button sx={{ alignSelf: "flex-end" }} onClick={() => change("entries", [...draft.entries, { description: "", quantity: 1, unitPrice: 0 }])}>Leistung hinzufügen</Button>
    <TextField label="Text" multiline minRows={3} value={draft.text} onChange={(e) => change("text", e.target.value)} />
    <DocumentActions disabled={locked} dirty={dirty} saveDisabled={!draft.creditNumber.trim()} pdfHref={credit ? `/api/admin/credits/${credit.id}/pdf` : undefined} onSave={save}
      onEmail={credit ? () => onEmail({ type: "credit", id: credit.id }) : undefined}
      onArchive={credit ? () => void run(() => apiRequest(`/api/admin/credits/${credit.id}/archive`, "POST"), "Gutschrift archiviert.") : undefined}
      onCancel={credit ? undefined : () => { setDraft(undefined); setDirty(false); }} />
  </Panel>;
}

function DocumentActions({ disabled, dirty, saveDisabled, pdfHref, onSave, onEmail, onArchive, onDelete, onCancel }: { disabled: boolean; dirty: boolean; saveDisabled?: boolean; pdfHref?: string | undefined; onSave: () => void; onEmail?: (() => void) | undefined; onArchive?: (() => void) | undefined; onDelete?: (() => void) | undefined; onCancel?: (() => void) | undefined }) {
  // PDF and mail always use the saved state, so they wait until changes are saved.
  const documentDisabled = disabled || dirty;
  return <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end", flexWrap: "wrap" }}>
    {onCancel && <Button disabled={disabled} onClick={onCancel}>Abbrechen</Button>}
    {onArchive && <Button color="warning" disabled={disabled} onClick={onArchive}>Archivieren</Button>}
    {onDelete && <Button color="error" disabled={disabled} onClick={onDelete}>Löschen</Button>}
    {pdfHref && <Tooltip title={dirty ? "Bitte zuerst speichern." : ""}><span><Button component="a" href={documentDisabled ? undefined : pdfHref} disabled={documentDisabled}>PDF</Button></span></Tooltip>}
    {onEmail && <Tooltip title={dirty ? "Bitte zuerst speichern." : ""}><span><Button disabled={documentDisabled} onClick={onEmail}>E-Mail</Button></span></Tooltip>}
    <Button variant="contained" disabled={disabled || !dirty || saveDisabled} onClick={onSave}>Speichern</Button>
  </Stack>;
}

function ArchivedRow({ label, disabled, onRestore }: { label: string; disabled: boolean; onRestore: () => void }) {
  return <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}><Typography variant="body2" color="text.secondary">{label}</Typography><Button size="small" disabled={disabled} onClick={onRestore}>Wiederherstellen</Button></Stack>;
}

function Panel({ children }: { children: ReactNode }) {
  return <Paper component="section" variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}><Stack spacing={2}>{children}</Stack></Paper>;
}
