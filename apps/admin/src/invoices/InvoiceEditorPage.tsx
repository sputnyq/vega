import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button, CircularProgress, Grid, IconButton, Paper, Stack, TextField, Typography } from "@mui/material";
import FileDownloadOutlined from "@mui/icons-material/FileDownloadOutlined";
import DeleteOutlined from "@mui/icons-material/DeleteOutlined";
import type { AdminInvoiceDto, InvoiceInput } from "@vega/domain";

const emptyInvoice = (): InvoiceInput => ({ invoiceDate: new Date().toISOString().slice(0, 10), company: "", customerName: "", customerStreet: "", customerPostalCity: "", taxPercent: 19, text: "", entries: [], dueDates: [] });

export function InvoiceEditorPage({ id, navigate }: { id?: string; navigate: (path: string) => void }) {
  const [value, setValue] = useState<InvoiceInput>(emptyInvoice);
  const [busy, setBusy] = useState(id !== undefined);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  useEffect(() => {
    if (!id) return;
    void fetch(`/api/admin/invoices/${id}`).then(async (response) => ({ response, body: await response.json() as { data?: AdminInvoiceDto } })).then(({ response, body }) => {
      if (!response.ok || !body.data) setError("Rechnung konnte nicht geladen werden.");
      else setValue({ invoiceNumber: body.data.invoiceNumber, invoiceDate: body.data.invoiceDate, company: body.data.company, customerName: body.data.customerName, customerStreet: body.data.customerStreet, customerPostalCity: body.data.customerPostalCity, taxPercent: body.data.taxPercent, text: body.data.text, entries: body.data.entries as InvoiceInput["entries"], dueDates: body.data.dueDates as InvoiceInput["dueDates"] });
    }).catch(() => setError("Rechnung konnte nicht geladen werden.")).finally(() => setBusy(false));
  }, [id]);
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
    event.preventDefault(); setBusy(true); setError("");
    try {
      const response = await fetch(id ? `/api/admin/invoices/${id}` : "/api/admin/invoices", { method: id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(value) });
      const body = await response.json() as { data?: AdminInvoiceDto; error?: { message?: string } };
      if (!response.ok || !body.data) { setError(body.error?.message ?? "Rechnung konnte nicht gespeichert werden."); return; }
      if (!id) navigate(`/invoices/${body.data.id}`); else setSuccess("Rechnung gespeichert.");
    } catch { setError("Rechnung konnte nicht gespeichert werden."); } finally { setBusy(false); }
  }
  function renderCustomerFields() {
    return <Grid container spacing={2}><Grid size={{ xs: 12, md: 6 }}><Stack spacing={1.5}><TextField label="Firma" value={value.company} onChange={(e) => change("company", e.target.value)} /><TextField label="Kunde" required value={value.customerName} onChange={(e) => change("customerName", e.target.value)} /><TextField label="Straße, Nr." value={value.customerStreet} onChange={(e) => change("customerStreet", e.target.value)} /><TextField label="PLZ, Ort" value={value.customerPostalCity} onChange={(e) => change("customerPostalCity", e.target.value)} /></Stack></Grid><Grid size={{ xs: 12, md: 6 }}><Stack spacing={1.5}><TextField label="Rechnungsdatum" type="date" required value={value.invoiceDate} onChange={(e) => change("invoiceDate", e.target.value)} slotProps={{ inputLabel: { shrink: true } }} /><TextField label="Rechnungsnummer" value={value.invoiceNumber ?? ""} onChange={(e) => change("invoiceNumber", e.target.value || undefined)} helperText="Leer lassen für automatische Nummer." /><TextField label="Umsatzsteuer (%)" type="number" value={value.taxPercent} onChange={(e) => change("taxPercent", Number(e.target.value))} /></Stack></Grid></Grid>;
  }
  function renderEntries() {
    return <><Typography variant="h6">Leistungen</Typography>{value.entries.map((entry, index) => <Stack key={index} direction={{ xs: "column", md: "row" }} spacing={1}><TextField label="Beschreibung" value={entry.description} onChange={(e) => updateEntry(index, { description: e.target.value })} fullWidth /><TextField label="Menge" type="number" value={entry.quantity} onChange={(e) => updateEntry(index, { quantity: Number(e.target.value) })} /><TextField label="Einzelpreis" type="number" value={entry.unitPrice} onChange={(e) => updateEntry(index, { unitPrice: Number(e.target.value) })} /><IconButton onClick={() => removeEntry(index)}><DeleteOutlined /></IconButton></Stack>)}<Button onClick={addEntry} sx={{ alignSelf: "flex-start" }}>Leistung hinzufügen</Button></>;
  }
  function renderFormFields() {
    return <>{renderCustomerFields()}{renderEntries()}<TextField label="Rechnungstext" multiline minRows={4} value={value.text} onChange={(e) => change("text", e.target.value)} /><Stack direction="row" spacing={1}><Button type="submit" variant="contained" disabled={busy}>Speichern</Button>{id && <Button component="a" href={`/api/admin/invoices/${id}/pdf`} startIcon={<FileDownloadOutlined />} variant="outlined">PDF speichern</Button>}</Stack></>;
  }
  return <Paper component="form" onSubmit={submit} variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}><Stack spacing={2}><Typography component="h2" variant="h5">{id ? "Rechnung bearbeiten" : "Neue Rechnung"}</Typography>{error && <Alert severity="error">{error}</Alert>}{success && <Alert severity="success">{success}</Alert>}{busy && id ? <CircularProgress /> : renderFormFields()}</Stack></Paper>;
}
