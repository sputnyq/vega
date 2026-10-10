import type { AdminRoute } from "../routes.js";
import { CategoriesPage } from "../catalog/CategoriesPage.js";
import { FurniturePage } from "../catalog/FurniturePage.js";
import { OffersPage } from "../catalog/OffersPage.js";
import { PackingsPage } from "../catalog/PackingsPage.js";
import { ServicesPage } from "../catalog/ServicesPage.js";
import { ServiceRatesEditor } from "../catalog/ServiceRatesEditor.js";

interface ContentManagementPageProps {
  route: AdminRoute;
}

export function ContentManagementPage({ route }: ContentManagementPageProps) {
  return route.contentSection === "categories"
    ? <CategoriesPage />
    : route.contentSection === "furniture"
      ? <FurniturePage />
      : route.contentSection === "offers"
        ? <OffersPage />
        : route.contentSection === "packings"
          ? <PackingsPage />
          : route.contentSection === "services"
            ? <ServicesPage />
            : route.contentSection === "prices"
              ? <ServiceRatesEditor />
              : null;
}
