import { useEffect, useState, type ReactNode } from "react";
import {
  AccountCircleOutlined,
  ArchiveOutlined,
  ContentCopyOutlined,
  ExpandLess,
  ExpandMore,
  FileDownloadOutlined,
  FormatListNumberedOutlined,
  Inventory2Outlined,
  LogoutOutlined,
  MenuOutlined,
  EmailOutlined,
  PeopleAltOutlined,
  ReceiptLongOutlined,
  SaveOutlined,
  SettingsOutlined,
} from "@mui/icons-material";
import {
  AppBar,
  Badge,
  Box,
  Collapse,
  Container,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { authClient } from "../auth-client.js";
import type { AdminRoute } from "../routes.js";
import type { StaffUser } from "../types.js";

interface AdminShellProps {
  user: StaffUser;
  route: AdminRoute;
  pathname: string;
  navigate: (path: string) => void;
  orderSaved?: boolean;
  orderDirty?: boolean;
  orderBusy?: boolean;
  invoiceBusy?: boolean;
  invoiceNumber?: string | undefined;
  children: ReactNode;
}

export function AdminShell({ user, route, pathname, navigate, orderSaved = false, orderDirty = false, orderBusy = false, invoiceBusy = false, invoiceNumber, children }: AdminShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contentOpen, setContentOpen] = useState(route.settingsArea === "content");
  const [archiveOpen, setArchiveOpen] = useState(
    pathname === "/orders/archived" || pathname === "/invoices/archived",
  );
  const [busy, setBusy] = useState(false);
  const isAdmin = user.role === "Admin";
  const isContentArea = route.settingsArea === "content";
  const isArchivePath = pathname === "/orders/archived" || pathname === "/invoices/archived";
  const editedOrderNumber = pathname.match(/^\/edit\/(-?\d+)$/u)?.[1];
  const editedInvoiceId = pathname === "/invoices/new" ? undefined : pathname.match(/^\/invoices\/([^/]+)$/u)?.[1];
  const isInvoiceEditor = editedInvoiceId !== undefined || pathname === "/invoices/new" || pathname === "/blanco" || route.sourceOrderNumber !== undefined;
  const headerTitle = editedOrderNumber
    ? `Auftrag | ${editedOrderNumber === "-1" ? "Neu" : editedOrderNumber}`
    : isInvoiceEditor
      ? editedInvoiceId ? invoiceNumber ? `Rechnung | ${invoiceNumber}` : "Rechnung" : "Rechnung | Neu"
      : route.title;

  useEffect(() => {
    if (isContentArea) setContentOpen(true);
  }, [isContentArea]);

  useEffect(() => {
    if (isArchivePath) setArchiveOpen(true);
  }, [isArchivePath]);

  async function signOut() {
    setBusy(true);
    await authClient.signOut();
    window.location.assign("/login");
  }

  async function copyOrder() {
    if (!editedOrderNumber) return;
    const response = await fetch(`/api/admin/orders/${editedOrderNumber}/copy`, { method: "POST", credentials: "same-origin" });
    if (!response.ok) return;
    const body = await response.json() as { data?: { orderNumber?: number } };
    if (body.data?.orderNumber) navigate(`/edit/${body.data.orderNumber}`);
  }

  async function archiveOrder() {
    if (!editedOrderNumber || !window.confirm("Auftrag wirklich archivieren?")) return;
    const response = await fetch(`/api/admin/orders/${editedOrderNumber}/archive`, { method: "POST", credentials: "same-origin" });
    if (response.ok) navigate("/");
  }

  async function archiveInvoice() {
    if (!editedInvoiceId || !window.confirm("Rechnung vor dem Archivieren extern sichern. Rechnung wirklich archivieren?")) return;
    const response = await fetch(`/api/admin/invoices/${editedInvoiceId}/archive`, { method: "POST", credentials: "same-origin" });
    if (response.ok) {
      navigate("/invoices");
      return;
    }
    window.alert("Rechnung konnte nicht archiviert werden.");
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="fixed" color="inherit" variant="outlined" elevation={0}>
        <Toolbar variant="dense">
          <IconButton color="inherit" onClick={() => setDrawerOpen(true)} aria-label="Menü öffnen">
            <MenuOutlined />
          </IconButton>
          <Typography component="h1" variant="h6" sx={{ flexGrow: 1, ml: 2 }}>{headerTitle}</Typography>
          {pathname.startsWith("/edit/") && !orderSaved && <>
            <Tooltip title="Speichern"><span><IconButton color="inherit" type="submit" form="order-create-form" disabled={orderBusy} aria-label="Auftrag speichern"><Badge color="error" variant="dot" invisible={!orderDirty}><SaveOutlined /></Badge></IconButton></span></Tooltip>
            {editedOrderNumber && <>
              <Tooltip title="Angebotskopie erstellen"><IconButton color="inherit" onClick={() => void copyOrder()} aria-label="Angebotskopie erstellen"><ContentCopyOutlined /></IconButton></Tooltip>
              <Tooltip title="Als PDF speichern"><span><IconButton color="inherit" type="submit" form="order-create-form" name="action" value="pdf" disabled={orderBusy} aria-label="PDF erzeugen"><FileDownloadOutlined /></IconButton></span></Tooltip>
              <Tooltip title="E-Mail-Versand wird mit PDF-Anhang und Versanddialog aktiviert"><span><IconButton color="inherit" disabled aria-label="E-Mail versenden"><EmailOutlined /></IconButton></span></Tooltip>
              <Divider orientation="vertical" flexItem sx={{ mx: 1.5, my: 1 }} />
              <Tooltip title="Archivieren"><IconButton color="warning" onClick={() => void archiveOrder()} aria-label="Auftrag archivieren"><ArchiveOutlined /></IconButton></Tooltip>
              {isAdmin && <>
                <Divider orientation="vertical" flexItem sx={{ mx: 1.5, my: 1 }} />
                <Tooltip title="Rechnung aus Auftrag anlegen"><span><IconButton color="inherit" type="submit" form="order-create-form" name="action" value="invoice" disabled={orderBusy} aria-label="Rechnung aus Auftrag anlegen"><ReceiptLongOutlined /></IconButton></span></Tooltip>
              </>}
            </>}
          </>}
          {editedInvoiceId && <>
            <Tooltip title="Speichern"><span><IconButton color="inherit" type="submit" form="invoice-editor-form" disabled={invoiceBusy} aria-label="Rechnung speichern"><SaveOutlined /></IconButton></span></Tooltip>
            <Tooltip title="PDF speichern"><IconButton color="inherit" component="a" href={`/api/admin/invoices/${editedInvoiceId}/pdf`} aria-label="Rechnungs-PDF speichern"><FileDownloadOutlined /></IconButton></Tooltip>
            <Tooltip title="Rechnungsversand wird mit Versanddialog und PDF-Anhang aktiviert"><span><IconButton color="inherit" disabled aria-label="Rechnung per E-Mail versenden"><EmailOutlined /></IconButton></span></Tooltip>
            <Divider orientation="vertical" flexItem sx={{ mx: 1.5, my: 1 }} />
            <Tooltip title="Archivieren"><IconButton color="warning" onClick={() => void archiveInvoice()} aria-label="Rechnung archivieren"><ArchiveOutlined /></IconButton></Tooltip>
          </>}
        </Toolbar>
      </AppBar>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 300, pt: 2, height: "100%", display: "flex", flexDirection: "column" }} role="navigation" aria-label="Hauptmenü">
          <Box>
            <Typography variant="subtitle1" color="primary" sx={{ px: 2, display: "block", fontWeight: 700 }}>Vega</Typography>
            <List>
              <ListItemButton selected={pathname === "/"} onClick={() => { setDrawerOpen(false); navigate("/"); }}>
                <ListItemIcon><FormatListNumberedOutlined /></ListItemIcon>
                <ListItemText primary="Aufträge" />
              </ListItemButton>
              <Divider sx={{ my: 1 }} />
              {isAdmin && (
                <>
                  <ListItemButton selected={pathname === "/invoices"} onClick={() => { setDrawerOpen(false); navigate("/invoices"); }}>
                    <ListItemIcon><ReceiptLongOutlined /></ListItemIcon>
                    <ListItemText primary="Rechnungen" />
                  </ListItemButton>
                  <Divider sx={{ my: 1 }} />
                </>
              )}
              <ListItemButton selected={isArchivePath} onClick={() => setArchiveOpen((open) => !open)}>
                <ListItemIcon><ArchiveOutlined /></ListItemIcon>
                <ListItemText primary="Archiv" />
                {archiveOpen ? <ExpandLess /> : <ExpandMore />}
              </ListItemButton>
              <Collapse in={archiveOpen} timeout="auto" unmountOnExit>
                <List component="div" disablePadding>
                  <ListItemButton
                    sx={{ pl: 4 }}
                    selected={pathname === "/orders/archived"}
                    onClick={() => { setDrawerOpen(false); navigate("/orders/archived"); }}
                  >
                    <ListItemIcon><FormatListNumberedOutlined /></ListItemIcon>
                    <ListItemText primary="Archivierte Aufträge" />
                  </ListItemButton>
                  {isAdmin && (
                    <ListItemButton
                      sx={{ pl: 4 }}
                      selected={pathname === "/invoices/archived"}
                      onClick={() => { setDrawerOpen(false); navigate("/invoices/archived"); }}
                    >
                      <ListItemIcon><ReceiptLongOutlined /></ListItemIcon>
                      <ListItemText primary="Archivierte Rechnungen" />
                    </ListItemButton>
                  )}
                </List>
              </Collapse>
              {isAdmin && (
                <>
                  <ListItemButton
                    selected={route.settingsArea === "options"}
                    onClick={() => { setDrawerOpen(false); navigate("/settings"); }}
                  >
                    <ListItemIcon><SettingsOutlined /></ListItemIcon>
                    <ListItemText primary="Optionen" />
                  </ListItemButton>
                  <ListItemButton selected={isContentArea} onClick={() => setContentOpen((open) => !open)}>
                    <ListItemIcon><Inventory2Outlined /></ListItemIcon>
                    <ListItemText primary="Content" />
                    {contentOpen ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>
                  <Collapse in={contentOpen} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {[
                        { label: "Angebote", path: "/settings/offers", section: "offers" },
                        { label: "Preise", path: "/settings/prices", section: "prices" },
                        { label: "Verpackung", path: "/settings/packings", section: "packings" },
                        { label: "Leistungen", path: "/settings/services", section: "services" },
                        { label: "Kategorien", path: "/settings/categories", section: "categories" },
                        { label: "Möbel", path: "/settings/furniture", section: "furniture" },
                      ].map((item) => (
                        <ListItemButton
                          key={item.path}
                          sx={{ pl: 4 }}
                          selected={route.contentSection === item.section}
                          onClick={() => { setDrawerOpen(false); navigate(item.path); }}
                        >
                          <ListItemText primary={item.label} />
                        </ListItemButton>
                      ))}
                    </List>
                  </Collapse>
                  <ListItemButton
                    selected={route.settingsArea === "users"}
                    onClick={() => { setDrawerOpen(false); navigate("/settings/users"); }}
                  >
                    <ListItemIcon><PeopleAltOutlined /></ListItemIcon>
                    <ListItemText primary="Nutzer" />
                  </ListItemButton>
                </>
              )}
              <Divider sx={{ my: 1 }} />
              <ListItemButton selected={pathname === "/profile"} onClick={() => { setDrawerOpen(false); navigate("/profile"); }}>
                <ListItemIcon><AccountCircleOutlined /></ListItemIcon>
                <ListItemText primary="Mein Profil" />
              </ListItemButton>
            </List>
          </Box>
          <Box sx={{ mt: "auto" }}>
            <Divider />
            <List>
              <ListItemButton onClick={signOut} disabled={busy}>
                <ListItemIcon><LogoutOutlined /></ListItemIcon>
                <ListItemText primary="Abmelden" />
              </ListItemButton>
            </List>
          </Box>
        </Box>
      </Drawer>
      <Toolbar />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {route.adminOnly && !isAdmin
          ? <Paper variant="outlined" sx={{ p: 3 }}><Typography color="error">Diese Route ist nur für Admins freigeschaltet.</Typography></Paper>
          : children}
      </Container>
    </Box>
  );
}
