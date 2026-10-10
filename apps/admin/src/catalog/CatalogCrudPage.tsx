import { useMemo, useState, type ReactNode } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { AddOutlined, DeleteOutlined, EditOutlined } from "@mui/icons-material";
import { useCatalogCollection, type IdentifiedCatalogRecord } from "./useCatalogCollection.js";

export interface CatalogChoice {
  label: string;
  value: string | number;
}

export interface CatalogField {
  name: string;
  label: string;
  type: "text" | "number" | "money" | "multiline" | "boolean" | "multiple";
  options?: CatalogChoice[];
  min?: number;
  max?: number;
  step?: number;
}

export interface CatalogColumn<T> {
  label: string;
  render: (item: T) => ReactNode;
}

interface CatalogCrudPageProps<T extends IdentifiedCatalogRecord> {
  resource: string;
  title: string;
  fields: CatalogField[];
  columns: CatalogColumn<T>[];
  defaults: Record<string, unknown>;
  toolbarContent?: ReactNode;
  filterPanel?: ReactNode;
  filterItem?: (item: T) => boolean;
}

export function CatalogCrudPage<T extends IdentifiedCatalogRecord>({
  resource,
  title,
  fields,
  columns,
  defaults,
  toolbarContent,
  filterPanel,
  filterItem,
}: CatalogCrudPageProps<T>) {
  const catalog = useCatalogCollection<T>(resource);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>(defaults);
  const [saving, setSaving] = useState(false);

  const dialogTitle = useMemo(() => editing ? `Eintrag bearbeiten · ${title}` : `Eintrag hinzufügen · ${title}`, [editing, title]);
  const visibleItems = useMemo(() => filterItem ? catalog.items.filter(filterItem) : catalog.items, [catalog.items, filterItem]);

  function openCreate() {
    setEditing(null);
    setForm({ ...defaults });
    catalog.setError(null);
    setDialogOpen(true);
  }

  function openEdit(item: T) {
    setEditing(item);
    setForm(Object.fromEntries(fields.map((field) => [field.name, (item as Record<string, unknown>)[field.name] ?? defaults[field.name] ?? (field.type === "multiple" ? [] : "")])));
    catalog.setError(null);
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    catalog.setError(null);
    try {
      if (editing) await catalog.update(editing.id, form);
      else await catalog.create(form);
      setDialogOpen(false);
    } catch (cause) {
      catalog.setError(cause instanceof Error ? cause.message : "Der Eintrag konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: T) {
    if (!window.confirm(`„${String((item as Record<string, unknown>).name ?? item.id)}“ wirklich löschen?`)) return;
    catalog.setError(null);
    try {
      await catalog.remove(item.id);
    } catch (cause) {
      catalog.setError(cause instanceof Error ? cause.message : "Der Eintrag konnte nicht gelöscht werden.");
    }
  }

  function renderField(field: CatalogField) {
    const value = form[field.name];
    if (field.type === "boolean") {
      return (
        <FormControlLabel
          key={field.name}
          control={<Checkbox checked={value === true} onChange={(event) => setForm((current) => ({ ...current, [field.name]: event.target.checked }))} />}
          label={field.label}
        />
      );
    }
    if (field.type === "multiple") {
      const selected = Array.isArray(value) ? value.map((entry) => String(entry)) : [];
      return (
        <FormControl key={field.name} fullWidth size="small" margin="dense">
          <InputLabel>{field.label}</InputLabel>
          <Select
            multiple
            label={field.label}
            value={selected}
            onChange={(event) => {
              const selectedValues = event.target.value;
              setForm((current) => ({ ...current, [field.name]: (typeof selectedValues === "string" ? selectedValues.split(",") : selectedValues).map(Number) }));
            }}
            renderValue={(picked) => (picked as string[]).map((pickedValue) => field.options?.find((option) => String(option.value) === pickedValue)?.label ?? pickedValue).join(", ")}
          >
            {(field.options ?? []).map((option) => (
              <MenuItem key={String(option.value)} value={String(option.value)}>
                <Checkbox checked={selected.includes(String(option.value))} />{option.label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      );
    }
    return (
      <TextField
        key={field.name}
        fullWidth
        label={field.label}
        type={field.type === "money" || field.type === "number" ? "number" : "text"}
        multiline={field.type === "multiline"}
        minRows={field.type === "multiline" ? 3 : undefined}
        value={value ?? ""}
        onChange={(event) => setForm((current) => ({
          ...current,
          [field.name]: field.type === "money" || field.type === "number" ? (event.target.value === "" ? 0 : Number(event.target.value)) : event.target.value,
        }))}
        slotProps={{
          htmlInput: {
            ...(field.min !== undefined ? { min: field.min } : {}),
            ...(field.max !== undefined ? { max: field.max } : {}),
            ...(field.step !== undefined ? { step: field.step } : field.type === "money" ? { step: "0.01" } : {}),
          },
        }}
      />
    );
  }

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ justifyContent: "space-between", alignItems: { sm: "center" } }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
          {toolbarContent}
          <Button variant="contained" startIcon={<AddOutlined />} onClick={openCreate}>Hinzufügen</Button>
        </Stack>
      </Stack>
      {filterPanel}
      {catalog.error && !dialogOpen && <Alert severity="error">{catalog.error}</Alert>}
      {catalog.loading ? <Typography color="text.secondary">Wird geladen …</Typography> : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small" aria-label={title}>
            <TableHead>
              <TableRow>
                {columns.map((column) => <TableCell key={column.label}>{column.label}</TableCell>)}
                <TableCell align="right">Aktionen</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {visibleItems.map((item) => (
                <TableRow key={item.id} hover>
                  {columns.map((column) => <TableCell key={column.label}>{column.render(item)}</TableCell>)}
                  <TableCell align="right" sx={{ whiteSpace: "nowrap" }}>
                    <Button size="small" startIcon={<EditOutlined />} onClick={() => openEdit(item)}>Bearbeiten</Button>
                    <Button size="small" color="error" aria-label="Eintrag löschen" onClick={() => void remove(item)}><DeleteOutlined /></Button>
                  </TableCell>
                </TableRow>
              ))}
              {visibleItems.length === 0 && <TableRow><TableCell colSpan={columns.length + 1} align="center">Noch keine Einträge für diesen Filter.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <Dialog open={dialogOpen} onClose={() => !saving && setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{dialogTitle}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.25} sx={{ pt: 1 }}>
            {catalog.error && <Alert severity="error">{catalog.error}</Alert>}
            {fields.map(renderField)}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)} disabled={saving}>Abbrechen</Button>
          <Button variant="contained" onClick={() => void save()} disabled={saving}>{saving ? "Speichert …" : "Speichern"}</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
