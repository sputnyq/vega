import { Button, Paper, Stack, Typography } from "@mui/material";
import type { AdminRoute } from "../routes.js";
import { CategoriesPage } from "../catalog/CategoriesPage.js";
import { FurniturePage } from "../catalog/FurniturePage.js";
import { OffersPage } from "../catalog/OffersPage.js";
import { PackingsPage } from "../catalog/PackingsPage.js";
import { ServicesPage } from "../catalog/ServicesPage.js";

const contentLinks = [
  ["Übersicht", "/settings/content", "overview"],
  ["Möbel", "/settings/content/furniture", "furniture"],
  ["Kategorien", "/settings/content/categories", "categories"],
  ["Angebote", "/settings/content/offers", "offers"],
  ["Verpackung", "/settings/content/packings", "packings"],
  ["Leistungen", "/settings/content/services", "services"],
] as const;

interface ContentManagementPageProps {
  route: AdminRoute;
  navigate: (path: string) => void;
}

export function ContentManagementPage({ route, navigate }: ContentManagementPageProps) {
  const isOverview = route.contentSection === "overview";
  const contentPage = route.contentSection === "categories"
    ? <CategoriesPage />
    : route.contentSection === "furniture"
      ? <FurniturePage />
      : route.contentSection === "offers"
        ? <OffersPage />
        : route.contentSection === "packings"
          ? <PackingsPage />
          : route.contentSection === "services"
            ? <ServicesPage />
            : null;

  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: 1 }}>
        <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
          {contentLinks.map(([label, path, section]) => (
            <Button key={path} size="small" variant={route.contentSection === section ? "contained" : "text"} onClick={() => navigate(path)}>
              {label}
            </Button>
          ))}
        </Stack>
      </Paper>
      {isOverview && (
        <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack spacing={1.5}>
            <Typography component="h2" variant="h5">{route.title}</Typography>
            <Typography color="text.secondary">{route.description}</Typography>
            <Typography variant="body2" color="text.secondary">
              Wählen Sie oben einen Bereich aus, um die zugehörige Verwaltung aufzurufen.
            </Typography>
          </Stack>
        </Paper>
      )}
      {contentPage}
    </Stack>
  );
}
