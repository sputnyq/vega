import type { CatalogCategoryDto } from "@vega/domain";
import { CatalogCrudPage, type CatalogColumn, type CatalogField } from "./CatalogCrudPage.js";

const fields: CatalogField[] = [
  { name: "name", label: "Name", type: "text" },
  { name: "sort", label: "Sortierung", type: "number", min: 0, step: 1 },
];

const columns: CatalogColumn<CatalogCategoryDto>[] = [
  { label: "ID", render: (category) => category.id },
  { label: "Sortierung", render: (category) => category.sort },
  { label: "Name", render: (category) => category.name },
];

export function CategoriesPage() {
  return (
    <CatalogCrudPage<CatalogCategoryDto>
      resource="categories"
      title="Möbel-Kategorien"
      fields={fields}
      columns={columns}
      defaults={{ name: "", sort: 0 }}
    />
  );
}
