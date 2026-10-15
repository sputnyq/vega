export interface AdminRoute {
  path: string;
  title: string;
  description: string;
  adminOnly?: boolean;
  profile?: boolean;
  sourceOrderNumber?: number;
  settingsArea?: "options" | "content" | "users";
  contentSection?: "furniture" | "categories" | "offers" | "packings" | "services" | "prices";
}

const fixedAdminRoutes: Record<string, AdminRoute> = {
  "/": { path: "/", title: "Aufträge", description: "Auftragsliste und Suche" },
  "/blanco": { path: "/blanco", title: "Neue Rechnung", description: "Neue Rechnung anlegen", adminOnly: true },
  "/invoices": { path: "/invoices", title: "Rechnungen", description: "Rechnungen suchen und verwalten", adminOnly: true },
  "/invoices/new": { path: "/invoices/new", title: "Neue Rechnung", description: "Neue Rechnung anlegen", adminOnly: true },
  "/invoices/archived": { path: "/invoices/archived", title: "Archivierte Rechnungen", description: "Archivierte Rechnungen wiederherstellen", adminOnly: true },
  "/orders/archived": { path: "/orders/archived", title: "Archivierte Aufträge", description: "Archivierte Aufträge wiederherstellen" },
  "/profile": { path: "/profile", title: "Mein Profil", description: "Mitarbeiterkonto und Sicherheit", profile: true },
  "/settings": { path: "/settings", title: "Optionen", description: "Vorhandene globale Einstellungen", adminOnly: true, settingsArea: "options" },
  "/settings/options": { path: "/settings/options", title: "Optionen", description: "Vorhandene globale Einstellungen", adminOnly: true, settingsArea: "options" },
  "/settings/content": { path: "/settings/services", title: "Leistungen", description: "Leistungen und Preisvorgaben", adminOnly: true, settingsArea: "content", contentSection: "services" },
  "/settings/content/furniture": { path: "/settings/furniture", title: "Möbel", description: "Möbelstammdaten", adminOnly: true, settingsArea: "content", contentSection: "furniture" },
  "/settings/content/categories": { path: "/settings/categories", title: "Möbel-Kategorien", description: "Möbelkategorien verwalten", adminOnly: true, settingsArea: "content", contentSection: "categories" },
  "/settings/content/offers": { path: "/settings/offers", title: "Angebote", description: "Globale Angebotsoptionen", adminOnly: true, settingsArea: "content", contentSection: "offers" },
  "/settings/content/packings": { path: "/settings/packings", title: "Verpackung", description: "Verpackungsleistungen und Preise", adminOnly: true, settingsArea: "content", contentSection: "packings" },
  "/settings/content/services": { path: "/settings/services", title: "Leistungen", description: "Leistungen und Preisvorgaben", adminOnly: true, settingsArea: "content", contentSection: "services" },
  "/settings/content/prices": { path: "/settings/prices", title: "Preise", description: "Globale Preise für AGB und Konfigurator", adminOnly: true, settingsArea: "content", contentSection: "prices" },
  "/settings/users": { path: "/settings/users", title: "Nutzer", description: "Mitarbeiterkonten, Rollen und TOTP-Verwaltung", adminOnly: true, settingsArea: "users" },
  // Keep short Settings URLs canonical; old /settings/content/* URLs redirect here.
  "/settings/offers": { path: "/settings/offers", title: "Angebote", description: "Globale Angebotsoptionen", adminOnly: true, settingsArea: "content", contentSection: "offers" },
  "/settings/packings": { path: "/settings/packings", title: "Verpackung", description: "Verpackungsleistungen und Preise", adminOnly: true, settingsArea: "content", contentSection: "packings" },
  "/settings/services": { path: "/settings/services", title: "Leistungen", description: "Leistungen und Preisvorgaben", adminOnly: true, settingsArea: "content", contentSection: "services" },
  "/settings/prices": { path: "/settings/prices", title: "Preise", description: "Globale Preise für AGB und Konfigurator", adminOnly: true, settingsArea: "content", contentSection: "prices" },
  "/settings/furniture": { path: "/settings/furniture", title: "Möbel", description: "Möbelstammdaten", adminOnly: true, settingsArea: "content", contentSection: "furniture" },
  "/settings/categories": { path: "/settings/categories", title: "Möbel-Kategorien", description: "Möbelkategorien verwalten", adminOnly: true, settingsArea: "content", contentSection: "categories" },
};

export function resolveAdminRoute(pathname: string): AdminRoute | null {
  const fixed = fixedAdminRoutes[pathname];
  if (fixed) return fixed;

  const invoiceDraft = pathname.match(/^\/invoices\/new\/from-order\/([1-9]\d*)$/u);
  if (invoiceDraft) {
    const orderNumber = Number(invoiceDraft[1]);
    if (!Number.isSafeInteger(orderNumber)) return null;
    return { path: pathname, title: "Neue Rechnung", description: `Rechnungsentwurf aus Auftrag ${orderNumber}`, adminOnly: true, sourceOrderNumber: orderNumber };
  }

  const editMatch = pathname.match(/^\/edit\/([^/]+)$/u);
  if (editMatch) {
    const id = decodePathSegment(editMatch[1]);
    if (id === null) return null;
    return {
      path: pathname,
      title: id === "-1" ? "Neuer Auftrag" : `Auftrag ${id}`,
      description: id === "-1" ? "Neuen Auftrag anlegen" : "Auftragsdaten bearbeiten",
    };
  }

  const emailTextMatch = pathname.match(/^\/email-text\/([^/]+)$/u);
  if (emailTextMatch) {
    const id = decodePathSegment(emailTextMatch[1]);
    if (id === null) return null;
    return {
      path: pathname,
      title: "E-Mail-Text",
      description: `E-Mail-Vorlage für Auftrag ${id}`,
    };
  }
  const invoiceMatch = pathname.match(/^\/invoices\/([^/]+)$/u);
  if (invoiceMatch) {
    const id = decodePathSegment(invoiceMatch[1]);
    if (id === null || id === "new" || id === "archived") return null;
    return { path: pathname, title: "Rechnung", description: "Rechnung bearbeiten", adminOnly: true };
  }

  return null;
}

function decodePathSegment(segment: string | undefined): string | null {
  if (segment === undefined) return null;
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}
