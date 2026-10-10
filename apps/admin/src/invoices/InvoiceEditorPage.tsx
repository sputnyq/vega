import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button, CircularProgress, Grid, IconButton, Paper, Stack, TextField, Typography } from "@mui/material";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import { manualInvoiceNextValue, MAX_INVOICE_SEQUENCE_VALUE, type AdminInvoiceDto, type InvoiceInput } from "@vega/domain";

const emptyInvoice = (): InvoiceInput => ({ invoiceDate: new Date().toISOString().slice(0, 10), company: "", customerName: "", customerStreet: "", customerPostalCity: "", taxPercent: 19, text: "", entries: [], dueDates: [] });

export function initializeInvoiceNumber(input: InvoiceInput, invoiceNumber: string | undefined): InvoiceInput {
  return input.invoiceNumber?.trim() || !invoiceNumber ? input : { ...input, invoiceNumber };
}

export function InvoiceNumberField({ invoiceNumber, nextValue, editing, onChange }: { invoiceNumber?: string | undefined; nextValue?: number | undefined; editing: boolean; onChange: (value: string | undefined) => void }) {
  const manualNumber = invoiceNumber?.trim().slice(0, 64);
  const manualNext = manualInvoiceNextValue(manualNumber);
  const invalid = !editing && manualNext !== undefined && (!Number.isSafeInteger(manualNext) || manualNext > MAX_INVOICE_SEQUENCE_VALUE);
  const usedNumber = manualNumber || (nextValue === undefined ? undefined : `R-${nextValue}`);
  const helperText = editing ? "Leer lassen, um die bisherige Nummer beizubehalten."
    : invalid ? "Rechnungsnummer überschreitet den unterstützten Nummernkreis (maximal R-2147483646)."
    : usedNumber ? `Verwendete Rechnungsnummer: ${usedNumber}.${manualNext !== undefined && nextValue !== undefined ? ` Nächste automatische Nummer: R-${Math.max(nextValue, manualNext)}.` : ""}`
    : "Automatische Rechnungsnummer wird geladen.";
  return <TextField label="Rechnungsnummer" value={invoiceNumber ?? ""} placeholder={!editing && nextValue !== undefined ? `R-${nextValue}` : undefined} onChange={(e) => onChange(e.target.value || undefined)} error={invalid} helperText={helperText} />;
}

export function InvoiceEditorPage({ id, orderNumber, navigate }: { id?: string; orderNumber?: number; navigate: (path: string) => void }) {
  const [value, setValue] = useState<InvoiceInput>(emptyInvoice);
  const [busy, setBusy] = useState(id !== undefined || orderNumber !== undefined);
  const [loading, setLoading] = useState(id !== undefined || orderNumber !== undefined);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [nextValue, setNextValue] = useState<number>();
  const [numberLoading, setNumberLoading] = useState(!id);
  useEffect(() => {
    if (id) return;
    let cancelled = false;
    setNumberLoading(true);
    setNextValue(undefined);
    void fetch("/api/admin/invoices/next-number", { credentials: "same-origin" }).then(async (response) => ({ response, body: await response.json() as { data?: { nextValue?: number }; error?: { message?: string } } })).then(({ response, body }) => {
      if (cancelled) return;
      const number = body.data?.nextValue;
      if (!response.ok || typeof number !== "number" || !Number.isSafeInteger(number) || number < 1 || number > MAX_INVOICE_SEQUENCE_VALUE) {
        setError(body.error?.message ?? "Rechnungsnummer konnte nicht geladen werden.");
        setLoadFailed(true);
      } else {
        setNextValue(number);
        setValue((current) => initializeInvoiceNumber(current, `R-${number}`));
      }
    }).catch(() => { if (!cancelled) { setError("Rechnungsnummer konnte nicht geladen werden."); setLoadFailed(true); } }).finally(() => { if (!cancelled) setNumberLoading(false); });
    return () => { cancelled = true; };
  }, [id, orderNumber]);
  useEffect(() => {
    if (!id && orderNumber === undefined) return;
    let cancelled = false;
    const path = id ? `/api/admin/invoices/${id}` : `/api/admin/invoices/from-order/${orderNumber}`;
    void fetch(path, { credentials: "same-origin" }).then(async (response) => ({ response, body: await response.json() as { data?: InvoiceInput; error?: { message?: string } } })).then(({ response, body }) => {
      if (cancelled) return;
      if (!response.ok || !body.data) {
        setError(body.error?.message ?? "Rechnung konnte nicht geladen werden.");
        setLoadFailed(true);
      } else {
        const loaded = body.data;
        setValue((current) => id ? loaded : initializeInvoiceNumber(loaded, current.invoiceNumber));
      }
    }).catch(() => { if (!cancelled) { setError("Rechnung konnte nicht geladen werden."); setLoadFailed(true); } }).finally(() => { if (!cancelled) { setBusy(false); setLoading(false); } });
    return () => { cancelled = true; };
  }, [id, orderNumber]);
  function change<K extends keyof InvoiceInput>(key: K, next: InvoiceInput[K]) { setValue((current) => ({ ...current, [key]: next })); }
  function updateEntry(index: number, patch: Partial<InvoiceInput["entries"][number]>) {
    change("entries", value.entries.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry));
  }
  function removeEntry(index: number) {
    change("entries", value.entries.filter((_, entryIndex) => entryIndex !== index));
  }
  function addEntry() {
    change("entries", [...value.entries, { description: "", quantity: 1, unitPrice: 0 }]);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loadFailed || (!id && nextValue === undefined)) return;
    setBusy(true); setError("");
    try {
      const path = id ? `/api/admin/invoices/${id}` : orderNumber !== undefined ? `/api/admin/invoices/from-order/${orderNumber}` : "/api/admin/invoices";
      const response = await fetch(path, { method: id ? "PUT" : "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
      const body = await response.json() as { data?: AdminInvoiceDto; error?: { message?: string } };
      if (!response.ok || !body.data) { setError(body.error?.message ?? "Rechnung konnte nicht gespeichert werden."); return; }
      if (!id) navigate(`/invoices/${body.data.id}`); else setSuccess("Rechnung gespeichert.");
    } catch { setError("Rechnung konnte nicht gespeichert werden."); } finally { setBusy(false); }
  }
  function renderCustomerFields() {
    return <Grid container spacing={2}><Grid size={{ xs: 12, md: 6 }}><Stack spacing={1.5}><TextField label="Firma" value={value.company} onChange={(e) => change("company", e.target.value)} /><TextField label="Kunde" required value={value.customerName} onChange={(e) => change("customerName", e.target.value)} /><TextField label="Straße, Nr." value={value.customerStreet} onChange={(e) => change("customerStreet", e.target.value)} /><TextField label="PLZ, Ort" value={value.customerPostalCity} onChange={(e) => change("customerPostalCity", e.target.value)} /></Stack></Grid><Grid size={{ xs: 12, md: 6 }}><Stack spacing={1.5}><TextField label="Rechnungsdatum" type="date" required value={value.invoiceDate} onChange={(e) => change("invoiceDate", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} /><InvoiceNumberField invoiceNumber={value.invoiceNumber} nextValue={nextValue} editing={!!id} onChange={(number) => change("invoiceNumber", number)} />{!id && <Typography variant="caption">Vorschau ohne Reservierung; die automatische Nummer wird erst beim Speichern vergeben.</Typography>}<TextField label="Umsatzsteuer (%)" type="number" value={value.taxPercent} onChange={(e) => change("taxPercent", Number(e.target.value))} /></Stack></Grid></Grid>;
  }
  function renderEntries() {
    return <><Typography variant="h6">Leistungen</Typography>{value.entries.map((entry, index) => <Stack key={index} direction={{ xs: "column", md: "row" }} spacing={1}><TextField label="Beschreibung" value={entry.description} onChange={(e) => updateEntry(index, { description: e.target.value })} fullWidth /><TextField label="Menge" type="number" value={entry.quantity} onChange={(e) => updateEntry(index, { quantity: Number(e.target.value) })} /><TextField label="Einzelpreis" type="number" value={entry.unitPrice} onChange={(e) => updateEntry(index, { unitPrice: Number(e.target.value) })} /><IconButton onClick={() => removeEntry(index)}><DeleteOutlined /></IconButton></Stack>)}<Button onClick={addEntry} sx={{ alignSelf: "flex-start" }}>Leistung hinzufügen</Button></>;
  }
  function renderFormFields() {
    return <>{renderCustomerFields()}{renderEntries()}<TextField label="Rechnungstext" multiline minRows={4} value={value.text} onChange={(e) => change("text", e.target.value)} /><Stack direction="row" spacing={1}><Button type="submit" variant="contained" disabled={busy}>Speichern</Button>{id && <Button component="a" href={`/api/admin/invoices/${id}/pdf`} startIcon={<FileDownloadOutlined />} variant="outlined">PDF speichern</Button>}</Stack></>;
  }
  return <Paper component="form" onSubmit={submit} variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}><Stack spacing={2}><Typography component="h2" variant="h5">{id ? "Rechnung bearbeiten" : "Neue Rechnung"}</Typography>{orderNumber !== undefined && <Alert severity="info">Ungespeicherter Rechnungsentwurf aus Auftrag {orderNumber}. Die Rechnung wird erst mit „Speichern“ angelegt.</Alert>}{error && <Alert severity="error">{error}</Alert>}{success && <Alert severity="success">{success}</Alert>}{loading || numberLoading ? <CircularProgress /> : <fieldset disabled={busy || loadFailed} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><Stack spacing={2}>{renderFormFields()}</Stack></fieldset>}</Stack></Paper>;
}
