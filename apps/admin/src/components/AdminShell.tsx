import { useEffect, useState, type ReactNode } from "react";
import {
  AccountCircleOutlined,
  AddOutlined,
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
  children: ReactNode;
}

export function AdminShell({ user, route, pathname, navigate, orderSaved = false, orderDirty = false, children }: AdminShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(
    pathname === "/orders/archived" || pathname === "/invoices/archived",
  );
  const [busy, setBusy] = useState(false);
  const isAdmin = user.role === "Admin";
  const isArchivePath = pathname === "/orders/archived" || pathname === "/invoices/archived";
  const editedOrderNumber = pathname.match(/^\/edit\/(\d+)$/u)?.[1];

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

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="fixed" color="inherit" variant="outlined" elevation={0}>
        <Toolbar variant="dense">
          <IconButton color="inherit" onClick={() => setDrawerOpen(true)} aria-label="Menü öffnen">
            <MenuOutlined />
          </IconButton>
          <Typography component="h1" variant="h6" sx={{ flexGrow: 1, ml: 2 }}>{route.title}</Typography>
          {pathname.startsWith("/edit/") && !orderSaved && <>
            <Tooltip title="Speichern"><IconButton color="inherit" type="submit" form="order-create-form" aria-label="Auftrag speichern"><Badge color="error" variant="dot" invisible={!orderDirty}><SaveOutlined /></Badge></IconButton></Tooltip>
            {editedOrderNumber && <>
              <Tooltip title="Angebotskopie erstellen"><IconButton color="inherit" onClick={() => void copyOrder()} aria-label="Angebotskopie erstellen"><ContentCopyOutlined /></IconButton></Tooltip>
              <Tooltip title="PDF-Erzeugung wird mit dem Backend-PDF-Service aktiviert"><span><IconButton color="inherit" disabled aria-label="PDF erzeugen"><FileDownloadOutlined /></IconButton></span></Tooltip>
              <Tooltip title="E-Mail-Versand wird mit PDF-Anhang und Versanddialog aktiviert"><span><IconButton color="inherit" disabled aria-label="E-Mail versenden"><EmailOutlined /></IconButton></span></Tooltip>
              <Tooltip title="Archivieren"><IconButton color="warning" onClick={() => void archiveOrder()} aria-label="Auftrag archivieren"><ArchiveOutlined /></IconButton></Tooltip>
            </>}
          </>}
        </Toolbar>
      </AppBar>
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 300, pt: 2, height: "100%", display: "flex", flexDirection: "column" }} role="navigation" aria-label="Hauptmenü">
          <Box>
            <Typography variant="overline" color="primary" sx={{ px: 2 }}>Vega · Verwaltung</Typography>
            <List>
              <ListItemButton selected={pathname === "/edit/-1"} onClick={() => { setDrawerOpen(false); navigate("/edit/-1"); }}>
                <ListItemIcon><AddOutlined /></ListItemIcon>
                <ListItemText primary="Auftrag anlegen" />
              </ListItemButton>
              <ListItemButton selected={pathname === "/"} onClick={() => { setDrawerOpen(false); navigate("/"); }}>
                <ListItemIcon><FormatListNumberedOutlined /></ListItemIcon>
                <ListItemText primary="Alle Aufträge" />
              </ListItemButton>
              <Divider sx={{ my: 1 }} />
              {isAdmin && (
                <>
                  <ListItemButton selected={pathname === "/blanco" || pathname === "/invoices/new"} onClick={() => { setDrawerOpen(false); navigate("/blanco"); }}>
                    <ListItemIcon><ReceiptLongOutlined /></ListItemIcon>
                    <ListItemText primary="Neue Rechnung" />
                  </ListItemButton>
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
                  <ListItemButton
                    selected={route.settingsArea === "content"}
                    onClick={() => { setDrawerOpen(false); navigate("/settings/content"); }}
                  >
                    <ListItemIcon><Inventory2Outlined /></ListItemIcon>
                    <ListItemText primary="Content Management" />
                  </ListItemButton>
                  <ListItemButton
                    selected={route.settingsArea === "users"}
                    onClick={() => { setDrawerOpen(false); navigate("/settings/users"); }}
                  >
                    <ListItemIcon><PeopleAltOutlined /></ListItemIcon>
                    <ListItemText primary="User Management" />
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
