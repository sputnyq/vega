import { useEffect, useState, type ReactNode } from "react";
import {
  AccountCircleOutlined,
  AddOutlined,
  ArchiveOutlined,
  ExpandLess,
  ExpandMore,
  FormatListNumberedOutlined,
  Inventory2Outlined,
  LogoutOutlined,
  MenuOutlined,
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
  children: ReactNode;
}

export function AdminShell({ user, route, pathname, navigate, orderSaved = false, children }: AdminShellProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(
    pathname === "/orders/archived" || pathname === "/invoices/archived",
  );
  const [busy, setBusy] = useState(false);
  const isAdmin = user.role === "Admin";
  const isArchivePath = pathname === "/orders/archived" || pathname === "/invoices/archived";

  useEffect(() => {
    if (isArchivePath) setArchiveOpen(true);
  }, [isArchivePath]);

  async function signOut() {
    setBusy(true);
    await authClient.signOut();
    window.location.assign("/login");
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar position="fixed" color="inherit" variant="outlined" elevation={0}>
        <Toolbar variant="dense">
          <IconButton color="inherit" onClick={() => setDrawerOpen(true)} aria-label="Menü öffnen">
            <MenuOutlined />
          </IconButton>
          <Typography component="h1" variant="h6" sx={{ flexGrow: 1, ml: 2 }}>{route.title}</Typography>
          {pathname === "/edit/-1" && !orderSaved && (
            <Tooltip title="Speichern">
              <IconButton color="inherit" type="submit" form="order-create-form" aria-label="Auftrag speichern">
                <Badge color="error" variant="dot"><SaveOutlined /></Badge>
              </IconButton>
            </Tooltip>
          )}
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
