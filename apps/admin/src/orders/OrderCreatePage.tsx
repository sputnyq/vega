import { useEffect, useState, type FormEvent } from "react";
import { Alert, Button, Paper, Snackbar, Stack, Tab, Tabs } from "@mui/material";
import type { AdminOrderDetail, CreateOrderResult, OrderDetailsInput } from "@vega/domain";
import { AddressesTab } from "./AddressesTab.js";
import { BasisTab } from "./BasisTab.js";
import { ConditionsTab } from "./ConditionsTab.js";
import { CustomerTab } from "./CustomerTab.js";
import { ExtrasTab } from "./ExtrasTab.js";
import { FurnitureTab } from "./FurnitureTab.js";
import { JournalTab } from "./JournalTab.js";
import { createEmptyOrder, type OrderFormValue } from "./order-form-types.js";
import { downloadOrderPdf, saveAndFetchOrderPdf } from "./order-pdf-download.js";

const tabNames = ["Kunde", "Adressen", "Umzugsgut", "Extras", "Basis", "Konditionen", "Journal"];

interface OrderCreatePageProps {
  navigate: (path: string) => void;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  dirty: boolean;
  orderNumber?: number;
}

interface ApiErrorResponse {
  error?: {
    message?: string;
    issues?: Array<{ field: string; message: string }>;
  };
}

export function OrderCreatePage({ navigate, onSaved, onDirtyChange, onBusyChange, dirty, orderNumber }: OrderCreatePageProps) {
  const [value, setValue] = useState(createEmptyOrder);
  const [activeTab, setActiveTab] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<CreateOrderResult | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loading, setLoading] = useState(orderNumber !== undefined);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    onBusyChange(loading || busy || loadFailed);
  }, [loading, busy, loadFailed, onBusyChange]);

  useEffect(() => {
    if (orderNumber === undefined) return;
    let cancelled = false;
    void fetch(`/api/admin/orders/${orderNumber}`, { credentials: "same-origin" })
      .then(async (response) => ({ response, body: await response.json() as { data?: AdminOrderDetail; error?: { message?: string } } }))
      .then(({ response, body }) => {
        if (cancelled) return;
        if (!response.ok || !body.data) { setError(body.error?.message ?? "Auftrag konnte nicht geladen werden."); setLoadFailed(true); return; }
        const base = createEmptyOrder();
        const data = body.data.data;
        setValue({
          ...base,
          ...data,
          customer: { ...base.customer, ...data.customer },
          from: { ...base.from, ...data.from },
          to: { ...base.to, ...data.to },
          details: data.details ?? base.details,
        });
        onDirtyChange(false);
      })
      .catch(() => { if (!cancelled) { setError("Auftrag konnte nicht geladen werden."); setLoadFailed(true); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [onDirtyChange, orderNumber]);

  function update(patch: Partial<OrderFormValue>) {
    setValue((current) => ({ ...current, ...patch }));
    onDirtyChange(true);
  }

  function updateDetails(details: OrderDetailsInput) {
    setValue((current) => ({ ...current, details }));
    onDirtyChange(true);
  }

  async function save(): Promise<boolean> {
    const response = await fetch(orderNumber === undefined ? "/api/orders" : `/api/admin/orders/${orderNumber}`, {
      method: orderNumber === undefined ? "POST" : "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(value),
    });
    const body = await response.json() as { data?: CreateOrderResult | AdminOrderDetail } & ApiErrorResponse;
    if (!response.ok || !body.data) {
      const issues = body.error?.issues ?? [];
      const fieldErrors = issues.map((issue) => `${issue.field}: ${issue.message}`);
      const firstField = issues[0]?.field ?? "";
      if (firstField.startsWith("customer")) setActiveTab(0);
      else if (firstField === "from" || firstField === "to" || firstField.startsWith("details.secondaryFrom") || firstField.startsWith("details.secondaryTo")) setActiveTab(1);
      else if (firstField.startsWith("details.furniture")) setActiveTab(2);
      else if (firstField.startsWith("details.extras")) setActiveTab(3);
      else if (firstField === "movingDate" || firstField === "movingTime" || firstField.startsWith("date") || firstField.startsWith("details.basis")) setActiveTab(4);
      else if (firstField.startsWith("details.conditions")) setActiveTab(5);
      setError(fieldErrors.length > 0 ? fieldErrors.join(" · ") : body.error?.message ?? "Der Auftrag konnte nicht gespeichert werden.");
      return false;
    }
    if (orderNumber === undefined) {
      setSaved({ orderNumber: body.data.orderNumber });
      onSaved();
    } else {
      onDirtyChange(false);
      setSaveSuccess(true);
    }
    return true;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || loading || loadFailed) return;
    const submitter = (event.nativeEvent as SubmitEvent).submitter;
    const exportPdf = submitter instanceof HTMLButtonElement && submitter.value === "pdf";
    const createInvoice = submitter instanceof HTMLButtonElement && submitter.value === "invoice";
    setBusy(true);
    setError(null);
    try {
      if (exportPdf && orderNumber !== undefined) {
        if ((value.from.parkingSlot || value.to.parkingSlot)
          && !value.details.conditions.some((condition) => condition.description.toUpperCase().includes("HALTEVERBOT"))) {
          window.alert("Halteverbotzone(n) wurde(n) ausgewählt!\nBitte entweder die HVZ entfernen oder als Kondition aufnehmen.");
        }
        const file = await saveAndFetchOrderPdf(orderNumber, () => dirty ? save() : Promise.resolve(true));
        if (file) downloadOrderPdf(file);
      } else if (createInvoice && orderNumber !== undefined) {
        if (dirty && !await save()) return;
        navigate(`/invoices/new/from-order/${orderNumber}`);
      } else {
        await save();
      }
    } catch (error) {
      setError(error instanceof Error && !(error instanceof TypeError)
        ? error.message
        : "Der Server ist derzeit nicht erreichbar. Bitte versuchen Sie es erneut.");
    } finally {
      setBusy(false);
    }
  }

  if (saved) {
    return (
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 }, maxWidth: 780 }}>
        <Stack spacing={2}>
          <Alert severity="success">Auftrag {saved.orderNumber} wurde erfolgreich gespeichert.</Alert>
          <Button variant="contained" onClick={() => navigate("/")}>Zur Auftragsübersicht</Button>
        </Stack>
      </Paper>
    );
  }

  return (
    <Stack component="form" id="order-create-form" spacing={2} onSubmit={submit} noValidate>
      {loading && <Alert severity="info">Auftrag wird geladen …</Alert>}
      {error && <Alert severity="error" role="alert">{error}</Alert>}
      <Paper variant="outlined" sx={{ position: "sticky", top: 64, zIndex: 2 }}>
        <Tabs
          value={activeTab}
          onChange={(_, next: number) => setActiveTab(next)}
          variant="scrollable"
          allowScrollButtonsMobile
          aria-label="Auftragsschritte"
        >
          {tabNames.map((label, index) => <Tab key={label} id={`order-tab-${index}`} aria-controls={`order-tabpanel-${index}`} label={label} />)}
        </Tabs>
      </Paper>
      <fieldset disabled={busy || loading} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <div role="tabpanel" id="order-tabpanel-0" aria-labelledby="order-tab-0" hidden={activeTab !== 0}>
          <CustomerTab value={value} update={update} />
        </div>
        <div role="tabpanel" id="order-tabpanel-1" aria-labelledby="order-tab-1" hidden={activeTab !== 1}>
          <AddressesTab value={value} update={update} onDetailsChange={updateDetails} />
        </div>
        <div role="tabpanel" id="order-tabpanel-2" aria-labelledby="order-tab-2" hidden={activeTab !== 2}>
          <FurnitureTab value={value} update={update} onFurnitureChange={(furniture) => updateDetails({ ...value.details, furniture })} {...(orderNumber === undefined ? {} : { orderNumber })} />
        </div>
        <div role="tabpanel" id="order-tabpanel-3" aria-labelledby="order-tab-3" hidden={activeTab !== 3}>
          <ExtrasTab value={value} onExtrasChange={(extras) => updateDetails({ ...value.details, extras })} />
        </div>
        <div role="tabpanel" id="order-tabpanel-4" aria-labelledby="order-tab-4" hidden={activeTab !== 4}>
          <BasisTab value={value} update={update} onBasisChange={(basis) => updateDetails({ ...value.details, basis })} />
        </div>
        <div role="tabpanel" id="order-tabpanel-5" aria-labelledby="order-tab-5" hidden={activeTab !== 5}>
          <ConditionsTab value={value} onConditionsChange={(conditions) => updateDetails({ ...value.details, conditions })} />
        </div>
        <div role="tabpanel" id="order-tabpanel-6" aria-labelledby="order-tab-6" hidden={activeTab !== 6}>
          {activeTab === 6 && <JournalTab {...(orderNumber === undefined ? {} : { orderNumber })} />}
        </div>
      </fieldset>
      {busy && <Alert severity="info" role="status">Auftrag wird gespeichert …</Alert>}
      <Snackbar open={saveSuccess} autoHideDuration={4_000} onClose={() => setSaveSuccess(false)} anchorOrigin={{ vertical: "top", horizontal: "right" }}>
        <Alert severity="success" variant="filled" onClose={() => setSaveSuccess(false)}>Auftrag erfolgreich gespeichert.</Alert>
      </Snackbar>
    </Stack>
  );
}
