import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import {
  AccountCircleOutlined,
  CategoryOutlined,
  ChairOutlined,
  HandymanOutlined,
  ViewModuleOutlined,
  LocalOfferOutlined,
  PaymentsOutlined,
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
  Menu,
  MenuItem,
  Paper,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { authClient } from "../auth-client.js";
import { useAdminNotification } from "./AdminNotifications.js";
import type { AdminRoute } from "../routes.js";
import type { StaffUser } from "../types.js";
import type { EmailTarget } from "../email/EmailDialog.js";

// Loaded on demand so the rich-text editor stays out of the initial bundle.
const EmailDialog = lazy(() => import("../email/EmailDialog.js").then((module) => ({ default: module.EmailDialog })));

interface AdminShellProps {
  user: StaffUser;
  route: AdminRoute;
  pathname: string;
  navigate: (path: string) => void;
  orderDirty?: boolean;
  orderBusy?: boolean;
  orderIsCopy?: boolean;
  invoiceBusy?: boolean;
  invoiceDirty?: boolean;
  invoiceNumber?: string | undefined;
  children: ReactNode;
}

export function AdminShell({ user, route, pathname, navigate, orderDirty = false, orderBusy = false, orderIsCopy = false, invoiceBusy = false, invoiceDirty = false, invoiceNumber, children }: AdminShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [contentOpen, setContentOpen] = useState(route.settingsArea === "content");
  const [archiveOpen, setArchiveOpen] = useState(
    pathname === "/orders/archived" || pathname === "/invoices/archived",
  );
  const [busy, setBusy] = useState(false);
  const [emailMenuAnchor, setEmailMenuAnchor] = useState<HTMLElement | null>(null);
  const [emailTarget, setEmailTarget] = useState<EmailTarget | null>(null);
  const notify = useAdminNotification();
  const isAdmin = user.role === "Admin";
  const isContentArea = route.settingsArea === "content";
  const isArchivePath = pathname === "/orders/archived" || pathname === "/invoices/archived";
  const editedOrderNumber = pathname.match(/^\/edit\/(-?\d+)$/u)?.[1];
  const editedInvoiceId = pathname === "/invoices/new" || pathname === "/invoices/archived" ? undefined : pathname.match(/^\/invoices\/([^/]+)$/u)?.[1];
  const isInvoiceEditor = editedInvoiceId !== undefined || pathname === "/invoices/new" || pathname === "/blanco" || route.sourceOrderNumber !== undefined;
  const orderHasChanges = orderDirty || editedOrderNumber === "-1";
  const invoiceHasChanges = invoiceDirty || (isInvoiceEditor && !editedInvoiceId);
  const orderActionsDisabled = orderBusy || orderHasChanges;
  const invoiceActionsDisabled = invoiceBusy || invoiceHasChanges;
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

  useEffect(() => {
    setEmailMenuAnchor(null);
    setEmailTarget(null);
  }, [pathname]);

  async function signOut() {
    setBusy(true);
    await authClient.signOut();
    window.location.assign("/login");
  }

  async function copyOrder() {
    if (!editedOrderNumber || orderActionsDisabled) return;
    const response = await fetch(`/api/admin/orders/${editedOrderNumber}/copy`, { method: "POST", credentials: "same-origin" });
    if (!response.ok) return;
    const body = await response.json() as { data?: { orderNumber?: number } };
    if (body.data?.orderNumber) navigate(`/edit/${body.data.orderNumber}`);
  }

  async function archiveOrder() {
    if (!editedOrderNumber || orderActionsDisabled || !window.confirm("Auftrag wirklich archivieren?")) return;
    const response = await fetch(`/api/admin/orders/${editedOrderNumber}/archive`, { method: "POST", credentials: "same-origin" });
    if (response.ok) navigate("/");
  }

  function openOrderEmail(kind: "offer" | "offer-pair" | "decline") {
    setEmailMenuAnchor(null);
    if (editedOrderNumber && !orderActionsDisabled) setEmailTarget({ type: "order", orderNumber: Number(editedOrderNumber), kind });
  }

  async function archiveInvoice() {
    if (!editedInvoiceId || invoiceActionsDisabled || !window.confirm("Rechnung vor dem Archivieren extern sichern. Rechnung wirklich archivieren?")) return;
    const response = await fetch(`/api/admin/invoices/${editedInvoiceId}/archive`, { method: "POST", credentials: "same-origin" });
    if (response.ok) {
      navigate("/invoices");
      return;
    }
    notify("error", "Rechnung konnte nicht archiviert werden.");
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="fixed" color="inherit" variant="outlined" elevation={0}>
        <Toolbar variant="dense">
          <IconButton color="inherit" onClick={() => setDrawerOpen(true)} aria-label="Menü öffnen">
            <MenuOutlined />
          </IconButton>
          <Typography component="h1" variant="h6" sx={{ flexGrow: 1, ml: 2 }}>{headerTitle}</Typography>
          {pathname.startsWith("/edit/") && <>
            <Tooltip title="Speichern"><span><IconButton color="inherit" type="submit" form="order-create-form" disabled={orderBusy} aria-label="Auftrag speichern"><Badge color="error" variant="dot" invisible={!orderHasChanges}><SaveOutlined /></Badge></IconButton></span></Tooltip>
            {editedOrderNumber && <>
              <Tooltip title="Angebotskopie anlegen"><span><IconButton color="inherit" disabled={orderActionsDisabled} onClick={() => void copyOrder()} aria-label="Angebotskopie anlegen"><ContentCopyOutlined /></IconButton></span></Tooltip>
              <Tooltip title="Als PDF speichern"><span><IconButton color="inherit" type="submit" form="order-create-form" name="action" value="pdf" disabled={orderActionsDisabled} aria-label="PDF erzeugen"><FileDownloadOutlined /></IconButton></span></Tooltip>
              <Tooltip title="E-Mail versenden"><span><IconButton color="inherit" disabled={orderActionsDisabled} onClick={(event) => setEmailMenuAnchor(event.currentTarget)} aria-label="E-Mail versenden" aria-haspopup="menu"><EmailOutlined /></IconButton></span></Tooltip>
              <Menu anchorEl={emailMenuAnchor} open={emailMenuAnchor !== null} onClose={() => setEmailMenuAnchor(null)}>
                <MenuItem onClick={() => openOrderEmail("offer")}>Angebot versenden</MenuItem>
                {orderIsCopy && <MenuItem onClick={() => openOrderEmail("offer-pair")}>2 Angebote versenden</MenuItem>}
                <MenuItem onClick={() => openOrderEmail("decline")}>Absage versenden</MenuItem>
              </Menu>
              <Divider orientation="vertical" flexItem sx={{ mx: 1.5, my: 1 }} />
              <Tooltip title="Archivieren"><span><IconButton color="warning" disabled={orderActionsDisabled} onClick={() => void archiveOrder()} aria-label="Auftrag archivieren"><ArchiveOutlined /></IconButton></span></Tooltip>
              {isAdmin && <>
                <Divider orientation="vertical" flexItem sx={{ mx: 1.5, my: 1 }} />
                <Tooltip title="Rechnung aus Auftrag anlegen"><span><IconButton color="inherit" type="submit" form="order-create-form" name="action" value="invoice" disabled={orderActionsDisabled} aria-label="Rechnung aus Auftrag anlegen"><ReceiptLongOutlined /></IconButton></span></Tooltip>
              </>}
            </>}
          </>}
          {isInvoiceEditor && <>
            <Tooltip title="Speichern"><span><IconButton color="inherit" type="submit" form="invoice-editor-form" disabled={invoiceBusy} aria-label="Rechnung speichern"><Badge color="error" variant="dot" invisible={!invoiceHasChanges}><SaveOutlined /></Badge></IconButton></span></Tooltip>
            <Tooltip title="PDF speichern"><span><IconButton color="inherit" component="a" href={!invoiceActionsDisabled && editedInvoiceId ? `/api/admin/invoices/${editedInvoiceId}/pdf` : undefined} disabled={invoiceActionsDisabled} aria-label="Rechnungs-PDF speichern"><FileDownloadOutlined /></IconButton></span></Tooltip>
            <Tooltip title="Rechnung per E-Mail versenden"><span><IconButton color="inherit" disabled={invoiceActionsDisabled || !editedInvoiceId} onClick={() => { if (editedInvoiceId) setEmailTarget({ type: "invoice", id: editedInvoiceId }); }} aria-label="Rechnung per E-Mail versenden"><EmailOutlined /></IconButton></span></Tooltip>
            <Divider orientation="vertical" flexItem sx={{ mx: 1.5, my: 1 }} />
            <Tooltip title="Archivieren"><span><IconButton color="warning" disabled={invoiceActionsDisabled} onClick={() => void archiveInvoice()} aria-label="Rechnung archivieren"><ArchiveOutlined /></IconButton></span></Tooltip>
          </>}
        </Toolbar>
      </AppBar>
      {emailTarget && <Suspense fallback={null}><EmailDialog target={emailTarget} onClose={() => setEmailTarget(null)} /></Suspense>}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} sx={{ "& .MuiDivider-root": { mx: 2 } }}>
        <Box sx={{ width: 300, pt: 0.5, height: "100%", display: "flex", flexDirection: "column" }} role="navigation" aria-label="Hauptmenü">
          <Box>
            <Typography variant="subtitle1" color="primary" align="center" sx={{ px: 1, py: 0.5, display: "block", fontFamily: "ui-monospace, monospace", fontSize: "2rem", lineHeight: 1.2, fontWeight: 700 }}>VEGA</Typography>
            <Divider />
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
                    <ListItemIcon><ViewModuleOutlined /></ListItemIcon>
                    <ListItemText primary="Content" />
                    {contentOpen ? <ExpandLess /> : <ExpandMore />}
                  </ListItemButton>
                  <Collapse in={contentOpen} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {[
                        { label: "Angebote", path: "/settings/offers", section: "offers", icon: <LocalOfferOutlined /> },
                        { label: "Preise", path: "/settings/prices", section: "prices", icon: <PaymentsOutlined /> },
                        { label: "Verpackung", path: "/settings/packings", section: "packings", icon: <Inventory2Outlined /> },
                        { label: "Leistungen", path: "/settings/services", section: "services", icon: <HandymanOutlined /> },
                        { label: "Kategorien", path: "/settings/categories", section: "categories", icon: <CategoryOutlined /> },
                        { label: "Möbel", path: "/settings/furniture", section: "furniture", icon: <ChairOutlined /> },
                      ].map((item) => (
                        <ListItemButton
                          key={item.path}
                          sx={{ pl: 4 }}
                          selected={route.contentSection === item.section}
                          onClick={() => { setDrawerOpen(false); navigate(item.path); }}
                        >
                          <ListItemIcon sx={{ minWidth: 36 }}>{item.icon}</ListItemIcon>
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
