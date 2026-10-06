import { useCallback, useMemo, useState } from "react";
import { FilterList, FilterListOff } from "@mui/icons-material";
import { Card, Checkbox, FormControlLabel, FormGroup, IconButton, Stack, Typography } from "@mui/material";
import type { CatalogCategoryDto, CatalogFurnitureDto } from "@vega/domain";
import { CatalogCrudPage, type CatalogColumn, type CatalogField } from "./CatalogCrudPage.js";
import { useCatalogCollection } from "./useCatalogCollection.js";

const money = (value: number) => value.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

export function FurniturePage() {
  const categories = useCatalogCollection<CatalogCategoryDto>("categories");
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [showWithoutCategory, setShowWithoutCategory] = useState(false);
  const [filterBarVisible, setFilterBarVisible] = useState(false);
  const categoryChoices = useMemo(() => categories.items.map(({ id, name }) => ({ value: id, label: name })), [categories.items]);
  const filterItem = useCallback((item: CatalogFurnitureDto) => {
    if (selectedCategoryIds.length === 0 && !showWithoutCategory) return true;
    if (showWithoutCategory && item.categoryIds.length === 0) return true;
    return item.categoryIds.some((categoryId) => selectedCategoryIds.includes(categoryId));
  }, [selectedCategoryIds, showWithoutCategory]);
  const fields: CatalogField[] = [
    { name: "name", label: "Name", type: "text" },
    { name: "categoryIds", label: "Kategorien", type: "multiple", options: categoryChoices },
    { name: "volume", label: "Volumen (m³)", type: "number", min: 0, step: 0.01 },
    { name: "step", label: "Schrittgröße", type: "number", min: 1, step: 1 },
    { name: "sortOrder", label: "Sortierung", type: "number", min: 0, step: 1 },
    { name: "weight", label: "Gewicht", type: "text" },
    { name: "montagePrice", label: "Montagepreis (€)", type: "money", min: 0 },
    { name: "extraPrice", label: "Aufpreis (€)", type: "money", min: 0 },
    { name: "demontage", label: "Abbau erforderlich", type: "boolean" },
    { name: "notDismountable", label: "Nicht demontierbar", type: "boolean" },
    { name: "bulky", label: "Sperrig", type: "boolean" },
    { name: "montage", label: "Montage erforderlich", type: "boolean" },
    { name: "m100", label: "100 cm (Möbelaufzug)", type: "boolean" },
    { name: "m150", label: "150 cm (Möbelaufzug)", type: "boolean" },
  ];
  const columns: CatalogColumn<CatalogFurnitureDto>[] = [
    { label: "ID", render: (item) => item.id },
    { label: "Name", render: (item) => item.name },
    { label: "Kategorien", render: (item) => item.categoryRefs.map(({ name }) => name).join(", ") || "Ohne Kategorie" },
    { label: "Volumen", render: (item) => `${item.volume} m³` },
    { label: "Schritt", render: (item) => item.step ?? "—" },
    { label: "Montage", render: (item) => money(item.montagePrice) },
    { label: "Aufpreis", render: (item) => money(item.extraPrice) },
    { label: "Sortierung", render: (item) => item.sortOrder },
  ];
  const toolbarContent = (
    <IconButton
      color={filterBarVisible ? "primary" : "default"}
      aria-label={filterBarVisible ? "Filter schließen" : "Nach Kategorien filtern"}
      onClick={() => {
        setFilterBarVisible((visible) => {
          if (visible) {
            setSelectedCategoryIds([]);
            setShowWithoutCategory(false);
          }
          return !visible;
        });
      }}
    >
      {filterBarVisible ? <FilterListOff /> : <FilterList />}
    </IconButton>
  );
  const filterPanel = filterBarVisible ? (
    <Card variant="outlined" sx={{ p: 1 }}>
      <FormGroup row>
        <Typography variant="subtitle2" color="primary" sx={{ mr: 1, alignSelf: "center", fontWeight: "bold" }}>Kategorie:</Typography>
        <FormControlLabel label="Ohne Kategorie" control={<Checkbox checked={showWithoutCategory} onChange={(event) => setShowWithoutCategory(event.target.checked)} />} />
        {categories.items.map((category) => (
          <FormControlLabel
            key={category.id}
            label={category.name}
            control={<Checkbox checked={selectedCategoryIds.includes(category.id)} onChange={(event) => setSelectedCategoryIds((current) => event.target.checked ? [...current, category.id] : current.filter((id) => id !== category.id))} />}
          />
        ))}
      </FormGroup>
    </Card>
  ) : null;

  return (
    <Stack spacing={1.5}>
      {categories.error && <Typography color="error">Kategorien konnten nicht geladen werden: {categories.error}</Typography>}
      <CatalogCrudPage<CatalogFurnitureDto>
        resource="furniture"
        title="Möbel"
        description="Möbelstammdaten mit Kategorien, Volumen, Montageangaben und kundensichtbaren Aufpreisen verwalten."
        fields={fields}
        columns={columns}
        toolbarContent={toolbarContent}
        filterPanel={filterPanel}
        filterItem={filterItem}
        defaults={{ name: "", categoryIds: [], volume: 0, step: null, sortOrder: 0, weight: "", montagePrice: 0, extraPrice: 0, demontage: false, notDismountable: false, bulky: false, montage: false, m100: false, m150: false }}
      />
    </Stack>
  );
}
