import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import SearchIcon from "@mui/icons-material/Search";
import { useCallback, useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, IconButton, InputAdornment, Paper, Stack, Table, TableBody, TableCell, TableHead, TablePagination, TableRow, TextField } from "@mui/material";
import type { AdminOrderListItem } from "@vega/domain";

const PAGE_SIZE = 10;

export function OrdersPage({ archived = false, navigate }: { archived?: boolean; navigate: (path: string) => void }) {
  const [items, setItems] = useState<AdminOrderListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [activeSearch, setActiveSearch] = useState("");
  const [page, setPage] = useState(() => pageFromUrl());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadOrders = useCallback(async (nextPage: number, searchValue = "") => {
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ archived: String(archived), page: String(nextPage), pageSize: String(PAGE_SIZE) });
      if (searchValue.trim()) query.set("search", searchValue.trim());
      const response = await fetch(`/api/admin/orders?${query}`, { credentials: "same-origin" });
      const body = await response.json() as { data?: { items?: AdminOrderListItem[]; total?: number }; error?: { message?: string } };
      if (!response.ok || !body.data?.items || typeof body.data.total !== "number") {
        setError(body.error?.message ?? "Aufträge konnten nicht geladen werden.");
        return;
      }
      setItems(body.data.items); setTotal(body.data.total);
    } catch { setError("Aufträge konnten nicht geladen werden."); }
    finally { setLoading(false); }
  }, [archived]);

  useEffect(() => { void loadOrders(page, activeSearch); }, [activeSearch, loadOrders, page]);

  function setCurrentPage(nextPage: number) {
    const safePage = Math.max(1, nextPage);
    window.history.pushState(null, "", `${window.location.pathname}?page=${safePage}`);
    setPage(safePage);
  }

  async function onSearch() {
    const value = search.trim();
    if (!value) { onClear(); return; }
    setLoading(true); setError("");
    try {
      const query = new URLSearchParams({ archived: String(archived), page: "1", pageSize: String(PAGE_SIZE), search: value });
      const response = await fetch(`/api/admin/orders?${query}`, { credentials: "same-origin" });
      const body = await response.json() as { data?: { items?: AdminOrderListItem[]; total?: number }; error?: { message?: string } };
      if (!response.ok || !body.data?.items || typeof body.data.total !== "number") { setError(body.error?.message ?? "Aufträge konnten nicht geladen werden."); return; }
      if (/^\d+$/u.test(value) && body.data.items.length === 1) { navigate(`/edit/${body.data.items[0]!.orderNumber}`); return; }
      setItems(body.data.items); setTotal(body.data.total); setActiveSearch(value); setCurrentPage(1);
    } catch { setError("Aufträge konnten nicht geladen werden."); }
    finally { setLoading(false); }
  }

  function onClear() { setSearch(""); setActiveSearch(""); setCurrentPage(1); }
  async function changeArchive(orderNumber: number) {
    const response = await fetch(`/api/admin/orders/${orderNumber}/${archived ? "restore" : "archive"}`, { method: "POST", credentials: "same-origin" });
    if (!response.ok) { setError("Aktion konnte nicht ausgeführt werden."); return; }
    void loadOrders(page, activeSearch);
  }

  return <Stack spacing={2}>
    <Stack
      direction={{ xs: "column", sm: "row" }}
      spacing={1}
      sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}
    >
      <Box sx={{ width: 420, maxWidth: "100%" }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          <TextField
            size="small"
            label="Auftrag suchen"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void onSearch(); } }}
            fullWidth
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton aria-label="Suche leeren" onClick={onClear} disabled={loading || !search}>
                      <CloseIcon />
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <IconButton aria-label="Aufträge suchen" onClick={() => void onSearch()} disabled={loading}>
            <SearchIcon />
          </IconButton>
        </Stack>
      </Box>
      {!archived && (
        <Button variant="contained" onClick={() => navigate("/edit/-1")} sx={{ alignSelf: { xs: "flex-end", sm: "auto" } }}>
          Neuer Auftrag
        </Button>
      )}
    </Stack>
    {error && <Alert severity="error">{error}</Alert>}
    <Paper variant="outlined" sx={{ overflowX: "auto" }}>
      {loading && <Stack sx={{ height: 420, alignItems: "center", justifyContent: "center" }}><CircularProgress /></Stack>}
      {!loading && <Table size="small" sx={{ minWidth: 1100 }}><TableHead><TableRow>
        <TableCell>ID</TableCell><TableCell>Quelle</TableCell><TableCell>Kunde</TableCell><TableCell>Datum</TableCell><TableCell>Auszugsadresse</TableCell><TableCell padding="checkbox">HVZ</TableCell><TableCell>Einzugsadresse</TableCell><TableCell padding="checkbox">HVZ</TableCell><TableCell>Mann</TableCell><TableCell>3,5t</TableCell><TableCell>Std.</TableCell>
      </TableRow></TableHead><TableBody>
        {items.map((order) => <TableRow key={order.orderNumber} hover sx={{ "& td": { fontWeight: order.editedAt ? "normal" : 700 } }}>
          <TableCell><Button size="small" onClick={() => navigate(`/edit/${order.orderNumber}`)}>{order.orderNumber}</Button></TableCell>
          <TableCell>{order.source}</TableCell><TableCell>{order.customerName}</TableCell><TableCell>{formatDate(order.movingDate)}</TableCell><TableCell>{order.fromAddress}</TableCell><TableCell padding="checkbox">{order.fromParkingSlot && <CheckCircleIcon color="success" fontSize="small" />}</TableCell><TableCell>{order.toAddress}</TableCell><TableCell padding="checkbox">{order.toParkingSlot && <CheckCircleIcon color="success" fontSize="small" />}</TableCell><TableCell>{order.workers ?? ""}</TableCell><TableCell>{order.trucks ?? ""}</TableCell><TableCell>{order.hours ?? ""}</TableCell>
        </TableRow>)}
        {items.length === 0 && <TableRow><TableCell colSpan={11} align="center">Keine Aufträge gefunden.</TableCell></TableRow>}
      </TableBody></Table>}
      <TablePagination component="div" count={total} page={page - 1} onPageChange={(_, next) => setCurrentPage(next + 1)} rowsPerPage={PAGE_SIZE} rowsPerPageOptions={[PAGE_SIZE]} labelDisplayedRows={({ from, to, count }) => `${from}–${to} von ${count}`} />
    </Paper>
  </Stack>;
}

function pageFromUrl(): number { const value = Number(new URLSearchParams(window.location.search).get("page")); return Number.isInteger(value) && value > 0 ? value : 1; }
function formatDate(value: string): string { return value ? new Date(`${value}T00:00:00`).toLocaleDateString("de-DE") : ""; }
