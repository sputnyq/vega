export interface AdminRoute {
  path: string;
  title: string;
  description: string;
  adminOnly?: boolean;
  profile?: boolean;
  settingsArea?: "options" | "content" | "users";
  contentSection?: "overview" | "furniture" | "categories" | "offers" | "packings" | "services";
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
  "/settings/content": { path: "/settings/content", title: "Content Management", description: "Möbel, Kategorien, Angebote und Leistungen", adminOnly: true, settingsArea: "content", contentSection: "overview" },
  "/settings/content/furniture": { path: "/settings/content/furniture", title: "Möbel", description: "Möbelstammdaten", adminOnly: true, settingsArea: "content", contentSection: "furniture" },
  "/settings/content/categories": { path: "/settings/content/categories", title: "Möbel-Kategorien", description: "Möbelkategorien verwalten", adminOnly: true, settingsArea: "content", contentSection: "categories" },
  "/settings/content/offers": { path: "/settings/content/offers", title: "Angebote", description: "Globale Angebotsoptionen", adminOnly: true, settingsArea: "content", contentSection: "offers" },
  "/settings/content/packings": { path: "/settings/content/packings", title: "Verpackung", description: "Verpackungsleistungen und Preise", adminOnly: true, settingsArea: "content", contentSection: "packings" },
  "/settings/content/services": { path: "/settings/content/services", title: "Leistungen", description: "Leistungen und Preisvorgaben", adminOnly: true, settingsArea: "content", contentSection: "services" },
  "/settings/users": { path: "/settings/users", title: "User Management", description: "Mitarbeiterkonten, Rollen und TOTP-Verwaltung", adminOnly: true, settingsArea: "users" },
  // Keep the existing Settings URLs working while moving their navigation under Content Management.
  "/settings/offers": { path: "/settings/offers", title: "Angebote", description: "Globale Angebotsoptionen", adminOnly: true, settingsArea: "content", contentSection: "offers" },
  "/settings/packings": { path: "/settings/packings", title: "Verpackung", description: "Verpackungsleistungen und Preise", adminOnly: true, settingsArea: "content", contentSection: "packings" },
  "/settings/services": { path: "/settings/services", title: "Leistungen", description: "Leistungen und Preisvorgaben", adminOnly: true, settingsArea: "content", contentSection: "services" },
  "/settings/furniture": { path: "/settings/furniture", title: "Möbel", description: "Möbelstammdaten", adminOnly: true, settingsArea: "content", contentSection: "furniture" },
  "/settings/categories": { path: "/settings/categories", title: "Möbel-Kategorien", description: "Möbelkategorien verwalten", adminOnly: true, settingsArea: "content", contentSection: "categories" },
};

export function resolveAdminRoute(pathname: string): AdminRoute | null {
  const fixed = fixedAdminRoutes[pathname];
  if (fixed) return fixed;

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
