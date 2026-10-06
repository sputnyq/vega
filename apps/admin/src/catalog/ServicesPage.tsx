import type { CatalogServiceDto } from "@vega/domain";
import { Stack } from "@mui/material";
import { CatalogCrudPage, type CatalogColumn, type CatalogField } from "./CatalogCrudPage.js";
import { ServiceRatesEditor } from "./ServiceRatesEditor.js";

const money = (value: number) => value.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const fields: CatalogField[] = [
  { name: "name", label: "Name", type: "text" },
  { name: "price", label: "Preis (€)", type: "money", min: 0 },
  { name: "sort", label: "Sortierung", type: "number", min: 0, step: 1 },
  { name: "show", label: "Im Formular anzeigen", type: "boolean" },
];

const columns: CatalogColumn<CatalogServiceDto>[] = [
  { label: "ID", render: (service) => service.id },
  { label: "Name", render: (service) => service.name },
  { label: "Preis", render: (service) => money(service.price) },
  { label: "Sortierung", render: (service) => service.sort },
  { label: "Im Formular", render: (service) => service.show ? "Ja" : "Nein" },
];

export function ServicesPage() {
  return (
    <Stack spacing={3}>
      <CatalogCrudPage<CatalogServiceDto>
        resource="services"
        title="Leistungen"
        description="Bohrarbeiten und sonstige Leistungen pflegen. Ausgeblendete Einträge bleiben im Admin sichtbar, werden aber nicht öffentlich ausgeliefert."
        fields={fields}
        columns={columns}
        defaults={{ name: "", price: 0, sort: 0, show: true }}
      />
      <ServiceRatesEditor />
    </Stack>
  );
}
