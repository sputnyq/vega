import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Grid, InputAdornment, Paper, Stack, TextField, Typography } from "@mui/material";
import type { AppSettingsDto } from "@vega/domain";
import { catalogRequest } from "../catalog/catalog-api.js";
import { ServiceRatesEditor } from "../catalog/ServiceRatesEditor.js";

type SettingKey = Exclude<keyof AppSettingsDto, "revision">;
type SettingsDraft = Record<SettingKey, string>;
const groups: Array<{ title: string; fields: Array<{ key: SettingKey; label: string; type?: "number" | "url" | "email"; helper?: string }> }> = [
  { title: "Berechnungsoptionen", fields: [
    { key: "boxCbm", label: "Umzugskarton Volumen", type: "number", helper: "Volumen je Karton in m³; für Kundenrechner und serverseitige Auftragsberechnung." },
    { key: "kleiderboxCbm", label: "Kleiderbox Volumen", type: "number", helper: "Volumen je Kleiderbox in m³." },
  ] },
  { title: "Standort und Kundenformular", fields: [
    { key: "origin", label: "Standort", helper: "Betriebsadresse als Start und Ende der Fahrstrecke. Kein API-Host und keine CORS-Origin." },
    { key: "dataPrivacyUrl", label: "Datenschutz URL", type: "url", helper: "Ohne Datenschutzerklärung bleibt das Absenden des Kundenformulars gesperrt." },
    { key: "successUrl", label: "Success URL", type: "url", helper: "Optional: Weiterleitung nach erfolgreicher Anfrage. Leer: interne Dankeseite." },
    { key: "boxCalculatorUrl", label: "Kartonrechner URL", type: "url", helper: "Optionaler Link im Möbel-/Volumenrechner." },
  ] },
  { title: "E-Mail", fields: [
    { key: "companyEmail", label: "Firmenempfänger", type: "email", helper: "Empfänger für Benachrichtigungen über neue Kundenanfragen." },
    { key: "emailFromName", label: "Absendername", helper: "Anzeigename beim Versand über die Hostinger-Mailbox." },
    { key: "emailFromAddress", label: "Absenderadresse", type: "email", helper: "Muss zur serverseitig konfigurierten Hostinger-Mailbox passen. Die API erlaubt keine beliebige Absenderadresse." },
  ] },
];
const keys = groups.flatMap((group) => group.fields.map((field) => field.key));
function toDraft(settings: AppSettingsDto): SettingsDraft {
  return Object.fromEntries(keys.map((key) => [key, settings[key] === null ? "" : String(settings[key])])) as SettingsDraft;
}

export function OptionsPage() {
  const [saved, setSaved] = useState<AppSettingsDto | null>(null);
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [reload, setReload] = useState(0);
  const [invoiceNext, setInvoiceNext] = useState<number | null>(null);
  const [invoiceDraft, setInvoiceDraft] = useState("");
  const [invoiceBusy, setInvoiceBusy] = useState(false);
  const [invoiceError, setInvoiceError] = useState("");
  const [invoiceMessage, setInvoiceMessage] = useState("");
  const [invoiceReload, setInvoiceReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError("");
    void catalogRequest<AppSettingsDto>("/api/admin/settings").then((settings) => {
      if (active) { setSaved(settings); setDraft(toDraft(settings)); setIssues({}); setMessage(""); }
    }).catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Einstellungen konnten nicht geladen werden."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [reload]);
  useEffect(() => {
    let active = true;
    void catalogRequest<{ nextValue: number }>("/api/admin/settings/invoice-number").then((sequence) => {
      if (active) { setInvoiceNext(sequence.nextValue); setInvoiceDraft(String(sequence.nextValue)); setInvoiceError(""); }
    }).catch((reason: unknown) => { if (active) setInvoiceError(reason instanceof Error ? reason.message : "Nummernkreis konnte nicht geladen werden."); });
    return () => { active = false; };
  }, [invoiceReload]);
  const dirty = draft && saved ? keys.some((key) => draft[key] !== toDraft(saved)[key]) : false;
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!saved || !draft || busy) return;
    if (event.currentTarget instanceof HTMLFormElement && Array.from(event.currentTarget.querySelectorAll("input")).some((input) => input.validity.badInput)) {
      setError("Bitte prüfen Sie die Zahlenfelder. Ungültige Zahlen werden nicht als leere Werte gespeichert.");
      return;
    }
    if ((["boxCbm", "kleiderboxCbm"] as const).some((key) => draft[key].trim() && !Number.isFinite(Number(draft[key])))) {
      setError("Bitte geben Sie gültige Kartonvolumina ein.");
      return;
    }
    const payload = {
      revision: saved.revision,
      ...Object.fromEntries(keys.map((key) => [key, draft[key].trim() === "" ? null
        : key === "boxCbm" || key === "kleiderboxCbm" ? Number(draft[key]) : draft[key].trim()])),
    };
    setBusy(true); setError(""); setMessage(""); setIssues({});
    try {
      const response = await fetch("/api/admin/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, credentials: "same-origin", body: JSON.stringify(payload) });
      const result = await response.json() as { data?: AppSettingsDto; error?: { message?: string; issues?: Array<{ field: string; message: string }> } };
      if (!response.ok || !result.data) {
        setIssues(Object.fromEntries((result.error?.issues ?? []).map((issue) => [issue.field, issue.message])));
        throw new Error(result.error?.message ?? "Einstellungen konnten nicht gespeichert werden.");
      }
      setSaved(result.data); setDraft(toDraft(result.data)); setMessage("Einstellungen gespeichert. Das Kundenformular verwendet sie beim nächsten Laden.");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Der Server ist nicht erreichbar. Ihre Eingaben bleiben erhalten."); }
    finally { setBusy(false); }
  }
  async function saveInvoice() {
    if (invoiceNext === null || invoiceBusy) return;
    setInvoiceBusy(true); setInvoiceError(""); setInvoiceMessage("");
    try {
      const nextValue = Number(invoiceDraft);
      if (!Number.isSafeInteger(nextValue) || nextValue < 1) throw new Error("Bitte geben Sie eine positive ganze Rechnungsnummer ein.");
      const sequence = await catalogRequest<{ nextValue: number }>("/api/admin/settings/invoice-number", "PUT", { nextValue, expectedNextValue: invoiceNext });
      setInvoiceNext(sequence.nextValue); setInvoiceDraft(String(sequence.nextValue)); setInvoiceMessage("Rechnungsnummernkreis gespeichert.");
    } catch (reason) { setInvoiceError(reason instanceof Error ? reason.message : "Nummernkreis konnte nicht gespeichert werden."); }
    finally { setInvoiceBusy(false); }
  }
  return <Stack spacing={3}>
    <Typography component="h1" variant="h5">Optionen</Typography>
    <Alert severity="info">Leere Felder bleiben unkonfiguriert. Google-, Hostinger- und Datenbank-Zugangsdaten gehören ausschließlich in die Server-Runtime, nicht in diese Oberfläche.</Alert>
    {error && <Alert severity="error">{error}</Alert>}
    {message && <Alert severity="success">{message}</Alert>}
    {loading && <Alert severity="info">Einstellungen werden geladen …</Alert>}
    <Stack component="form" spacing={2} onSubmit={save} noValidate>
      <Grid container spacing={2}>{groups.map((group) => <Grid key={group.title} size={{ xs: 12, lg: group.title === "E-Mail" ? 12 : 6 }}>
        <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, height: "100%" }}><Stack spacing={1.5}>
          <Typography component="h2" variant="h6">{group.title}</Typography>
          {group.fields.map((field) => <TextField key={field.key} label={field.label} type={field.type ?? "text"} fullWidth
            value={draft?.[field.key] ?? ""} disabled={loading || busy || draft === null}
            error={Boolean(issues[field.key])} helperText={issues[field.key] ?? field.helper}
            onChange={(event) => setDraft((current) => current ? { ...current, [field.key]: event.target.value } : current)}
            slotProps={field.type === "number" ? { htmlInput: { min: 0.0001, max: 10, step: 0.0001 }, input: { endAdornment: <InputAdornment position="end">m³</InputAdornment> } } : { htmlInput: { maxLength: field.type === "url" ? 2048 : field.key === "origin" ? 300 : field.key === "emailFromName" ? 191 : 254 } }}
          />)}
        </Stack></Paper>
      </Grid>)}</Grid>
      <Stack direction="row" spacing={2}>
        <Button type="submit" variant="contained" disabled={!dirty || loading || busy}>{busy ? "Speichert …" : "Einstellungen speichern"}</Button>
        <Button disabled={busy} onClick={() => {
          if (!dirty || window.confirm("Ungespeicherte Änderungen verwerfen und Einstellungen neu laden?")) setReload((value) => value + 1);
        }}>Neu laden</Button>
      </Stack>
    </Stack>
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}><Stack spacing={2}>
      <Typography component="h2" variant="h6">Rechnungsnummernkreis</Typography>
      <Typography color="text.secondary">Nächste automatisch vergebene Rechnungsnummer: {invoiceNext === null ? "noch nicht geladen" : `R-${invoiceNext}`}. Bestehende Rechnungen werden nicht umnummeriert.</Typography>
      {invoiceError && <Alert severity="error">{invoiceError}</Alert>}{invoiceMessage && <Alert severity="success">{invoiceMessage}</Alert>}
      <TextField label="Nächste Rechnungsnummer" type="number" value={invoiceDraft} disabled={invoiceBusy || invoiceNext === null}
        onChange={(event) => setInvoiceDraft(event.target.value)} slotProps={{ htmlInput: { min: 1, step: 1 }, input: { startAdornment: <InputAdornment position="start">R-</InputAdornment> } }} />
      <Stack direction="row" spacing={2}><Button variant="outlined" disabled={invoiceBusy || invoiceNext === null || invoiceDraft === String(invoiceNext)} onClick={() => void saveInvoice()}>Nummernkreis speichern</Button>
        <Button disabled={invoiceBusy} onClick={() => setInvoiceReload((value) => value + 1)}>Nummernkreis neu laden</Button></Stack>
      <Typography variant="body2" color="text.secondary">Ein eigener Gutschriftennummernkreis wird erst mit dem freigegebenen Gutschriftenmodul angebunden.</Typography>
    </Stack></Paper>
    <Typography component="h2" variant="h6">Globale Preise</Typography>
    <ServiceRatesEditor />
  </Stack>;
}
