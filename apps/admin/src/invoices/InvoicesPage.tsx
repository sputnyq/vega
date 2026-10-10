import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, IconButton, InputAdornment, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField } from "@mui/material";
import type { AdminInvoiceDto } from "@vega/domain";

const currencyFormatter = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export function invoiceTotal(invoice: Pick<AdminInvoiceDto, "entries" | "taxPercent">): number {
  const net = invoice.entries.reduce((sum, entry) => sum + entry.quantity * entry.unitPrice, 0);
  return net + net * invoice.taxPercent / 100;
}

export function InvoicesPage({ archived = false, navigate }: { archived?: boolean; navigate: (path: string) => void }) {
  const [items, setItems] = useState<AdminInvoiceDto[]>([]);
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async (searchValue: string) => {
    setError("");
    try {
      const query = new URLSearchParams({ archived: String(archived) });
      if (searchValue) query.set("search", searchValue);
      const response = await fetch(`/api/admin/invoices?${query}`, { credentials: "same-origin" });
      const body = await response.json() as { data?: { items?: AdminInvoiceDto[] }; error?: { message?: string } };
      if (!response.ok || !body.data?.items) {
        setError(body.error?.message ?? "Rechnungen konnten nicht geladen werden.");
        return;
      }
      setItems(body.data.items);
    } catch {
      setError("Rechnungen konnten nicht geladen werden.");
    }
  }, [archived]);

  useEffect(() => { void load(activeSearch); }, [activeSearch, load]);

  function onSearch() {
    const value = search.trim();
    setActiveSearch(value);
    if (!value) setSearch("");
  }

  function onClear() {
    setSearch("");
    setActiveSearch("");
  }

  async function archive(id: string) {
    const response = await fetch(`/api/admin/invoices/${id}/${archived ? "restore" : "archive"}`, { method: "POST", credentials: "same-origin" });
    if (!response.ok) {
      setError("Aktion konnte nicht ausgeführt werden.");
      return;
    }
    void load(activeSearch);
  }

  return <Stack spacing={2}>
    <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
      <Box sx={{ width: 420, maxWidth: "100%" }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <TextField
            size="small"
            label="Rechnung suchen"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); onSearch(); } }}
            fullWidth
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton aria-label="Suche leeren" onClick={onClear} disabled={!search}>
                      <CloseIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <IconButton aria-label="Rechnungen suchen" onClick={onSearch}>
            <SearchIcon />
          </IconButton>
        </Stack>
      </Box>
      {!archived && (
        <Button variant="contained" onClick={() => navigate("/invoices/new")} sx={{ alignSelf: { xs: "flex-end", sm: "auto" } }}>
          Neue Rechnung
        </Button>
      )}
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}
    <Paper variant="outlined">
      <Table size="small">
        <TableHead><TableRow><TableCell>Nummer</TableCell><TableCell>Kunde</TableCell><TableCell>Auftragsnummer</TableCell><TableCell>Datum</TableCell><TableCell>Rechnungssumme</TableCell>{archived && <TableCell />}</TableRow></TableHead>
        <TableBody>
          {items.map((invoice) => (
            <TableRow key={invoice.id}>
              <TableCell><Button onClick={() => navigate(`/invoices/${invoice.id}`)}>{invoice.invoiceNumber}</Button></TableCell>
              <TableCell>{invoice.customerName}</TableCell>
              <TableCell>{invoice.orderNumber ?? "–"}</TableCell>
              <TableCell>{new Date(`${invoice.invoiceDate}T00:00:00`).toLocaleDateString("de-DE")}</TableCell>
              <TableCell>{currencyFormatter.format(invoiceTotal(invoice))}</TableCell>
              {archived && <TableCell><Button size="small" onClick={() => void archive(invoice.id)}>Wiederherstellen</Button></TableCell>}
            </TableRow>
          ))}
          {items.length === 0 && <TableRow><TableCell colSpan={archived ? 6 : 5} align="center">Keine Rechnungen vorhanden.</TableCell></TableRow>}
        </TableBody>
      </Table>
    </Paper>
  </Stack>;
}
