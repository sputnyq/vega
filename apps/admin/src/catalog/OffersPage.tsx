import type { CatalogOfferDto } from "@vega/domain";
import { CatalogCrudPage, type CatalogColumn, type CatalogField } from "./CatalogCrudPage.js";

const money = (value: number) => value.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
const fields: CatalogField[] = [
  { name: "name", label: "Bezeichnung", type: "text" },
  { name: "trucks", label: "LKW 3,5 t", type: "number", min: 1, max: 20, step: 1 },
  { name: "workers", label: "Träger", type: "number", min: 1, max: 100, step: 1 },
  { name: "includedHours", label: "Inklusive Stunden", type: "number", min: 1, max: 24, step: 1 },
  { name: "sum", label: "Grundpreis (€)", type: "money", min: 0 },
  { name: "hourPrice", label: "Zusatzstunde (€)", type: "money", min: 0 },
  { name: "ridingCosts", label: "Anfahrtskosten (€)", type: "money", min: 0 },
  { name: "sort", label: "Sortierung", type: "number", min: 0, step: 1 },
];

const columns: CatalogColumn<CatalogOfferDto>[] = [
  { label: "LKW 3,5 t", render: (offer) => offer.trucks },
  { label: "Träger", render: (offer) => offer.workers },
  { label: "Inklusive Stunden", render: (offer) => offer.includedHours },
  { label: "Grundpreis", render: (offer) => money(offer.sum) },
  { label: "Zusatzstunde", render: (offer) => money(offer.hourPrice) },
  { label: "Anfahrt", render: (offer) => money(offer.ridingCosts) },
  { label: "Sortierung", render: (offer) => offer.sort },
];

export function OffersPage() {
  return (
    <CatalogCrudPage<CatalogOfferDto>
      resource="offers"
      title="Angebote"
      description="Basisangebote nach LKW-Anzahl, Trägern und enthaltenen Stunden verwalten. Kombination aus LKW, Trägern und Stunden muss eindeutig sein."
      fields={fields}
      columns={columns}
      defaults={{ name: "", trucks: 1, workers: 2, includedHours: 4, sum: 0, hourPrice: 0, ridingCosts: 0, sort: 0 }}
    />
  );
}
