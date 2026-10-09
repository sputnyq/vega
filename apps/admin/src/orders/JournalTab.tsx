import { useEffect, useState } from "react";
import { Alert, CircularProgress, List, ListItem, ListItemText, Stack, Typography } from "@mui/material";
import type { AdminOrderJournalEntry } from "@vega/domain";

const ACTION_LABELS: Record<string, string> = {
  CREATED_PUBLIC: "Auftrag über das öffentliche Formular eingegangen",
  CREATED_ADMIN: "Auftrag in der Verwaltung angelegt",
  COPIED: "Angebotskopie erstellt",
  UPDATED: "Auftrag angepasst",
  ARCHIVED: "Auftrag archiviert",
  RESTORED: "Auftrag wiederhergestellt",
  PDF_EXPORTED: "PDF exportiert",
};

export function JournalTab({ orderNumber }: { orderNumber?: number }) {
  const [items, setItems] = useState<AdminOrderJournalEntry[]>([]);
  const [loading, setLoading] = useState(orderNumber !== undefined);
  const [error, setError] = useState("");
  useEffect(() => {
    if (orderNumber === undefined) return;
    let cancelled = false;
    void fetch(`/api/admin/orders/${orderNumber}/journal`, { credentials: "same-origin" })
      .then(async (response) => ({ response, body: await response.json() as { data?: { items?: AdminOrderJournalEntry[] }; error?: { message?: string } } }))
      .then(({ response, body }) => {
        if (cancelled) return;
        if (!response.ok || !body.data?.items) setError(body.error?.message ?? "Journal konnte nicht geladen werden.");
        else setItems(body.data.items);
      })
      .catch(() => { if (!cancelled) setError("Journal konnte nicht geladen werden."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [orderNumber]);

  if (orderNumber === undefined) return <Typography color="text.secondary">Das Journal steht nach dem ersten Speichern des Auftrags zur Verfügung.</Typography>;
  if (loading) return <Stack sx={{ py: 4, alignItems: "center" }}><CircularProgress /></Stack>;
  if (error) return <Alert severity="error">{error}</Alert>;
  return <Stack spacing={1}><Typography color="text.secondary">Das Journal protokolliert Aktionen, Zeitpunkte und Akteure ohne Feld-Diffs.</Typography><List disablePadding>{items.map((entry) => <ListItem key={entry.id} divider><ListItemText primary={labelFor(entry.action)} secondary={`${new Date(entry.occurredAt).toLocaleString("de-DE")} · ${entry.actorName}`} /></ListItem>)}{items.length === 0 && <Typography color="text.secondary">Noch keine Ereignisse vorhanden.</Typography>}</List></Stack>;
}

function labelFor(action: string): string {
  if (action.startsWith("EMAIL_SENT_")) return `E-Mail versandt (${action.slice("EMAIL_SENT_".length)})`;
  return ACTION_LABELS[action] ?? action;
}
