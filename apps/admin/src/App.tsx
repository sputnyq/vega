import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { Alert, CircularProgress, Container } from "@mui/material";
import { authClient } from "./auth-client.js";
import { AuthCard } from "./auth/AuthCard.js";
import { InitialPasswordChangePage } from "./auth/InitialPasswordChangePage.js";
import { SignInPage } from "./auth/SignInPage.js";
import { ForgotPasswordPage } from "./auth/ForgotPasswordPage.js";
import { ResetPasswordPage } from "./auth/ResetPasswordPage.js";
import { TotpSetupPage } from "./auth/TotpSetupPage.js";
import { AdminShell } from "./components/AdminShell.js";
import { NotFoundPage } from "./components/NotFoundPage.js";
import { RoutePlaceholderPage } from "./components/RoutePlaceholderPage.js";
import { ProfilePage } from "./profile/ProfilePage.js";
import { OptionsPage } from "./settings/OptionsPage.js";
import { UserManagementPage } from "./settings/UserManagementPage.js";
import { resolveAdminRoute } from "./routes.js";
import type { PendingInitialPassword, StaffUser } from "./types.js";
import { OrdersPage } from "./orders/OrdersPage.js";
import { InvoicesPage } from "./invoices/InvoicesPage.js";
import { InvoiceEditorPage } from "./invoices/InvoiceEditorPage.js";

const OrderCreatePage = lazy(() => import("./orders/OrderCreatePage.js").then((module) => ({ default: module.OrderCreatePage })));
const ContentManagementPage = lazy(() => import("./settings/ContentManagementPage.js").then((module) => ({ default: module.ContentManagementPage })));

function useLocalPathname() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const replacePath = useCallback((path: string) => {
    if (window.location.pathname === path) return;
    window.history.replaceState(null, "", path);
    setPathname(path);
  }, []);

  const navigatePath = useCallback((path: string) => {
    if (window.location.pathname === path) return;
    window.history.pushState(null, "", path);
    setPathname(path);
  }, []);

  return { pathname, replacePath, navigatePath };
}

export function App() {
  const { data: session, isPending } = authClient.useSession();
  const { pathname, replacePath, navigatePath } = useLocalPathname();
  const [initialPassword, setInitialPassword] = useState<PendingInitialPassword | null>(null);
  const [orderSaved, setOrderSaved] = useState(false);
  const [orderDirty, setOrderDirty] = useState(false);
  const [totpPassword, setTotpPassword] = useState<string | undefined>();
  const [twoFactorRequired, setTwoFactorRequired] = useState(() => window.location.pathname === "/two-factor");
  const route = resolveAdminRoute(pathname);
  const isAuthPath = pathname === "/login" || pathname === "/two-factor";
  const isPasswordResetPath = pathname === "/forgot-password" || pathname === "/reset-password";
  const isKnownPath = route !== null || isAuthPath || isPasswordResetPath;

  const onTwoFactorRequired = useCallback(() => {
    setTwoFactorRequired(true);
    replacePath("/two-factor");
  }, [replacePath]);

  const onCancelTwoFactor = useCallback(() => {
    setTwoFactorRequired(false);
    replacePath("/login");
  }, [replacePath]);

  useEffect(() => {
    if (isPending || !isKnownPath) return;
    if (!session && route) replacePath("/login");
    if (!session && pathname === "/two-factor" && !twoFactorRequired) replacePath("/login");
    if (session && isAuthPath) replacePath("/");
  }, [isAuthPath, isKnownPath, isPending, pathname, replacePath, route, session, twoFactorRequired]);

  useEffect(() => {
    setOrderSaved(false);
    setOrderDirty(false);
  }, [pathname]);

  if (!isKnownPath) return <NotFoundPage onHome={() => replacePath("/")} />;

  if (
    isPending ||
    (!session && route !== null) ||
    (session && isAuthPath) ||
    (!session && pathname === "/two-factor" && !twoFactorRequired)
  ) {
    return <Container sx={{ py: 10, display: "flex", justifyContent: "center" }}><CircularProgress /></Container>;
  }

  if (initialPassword) {
    return (
      <InitialPasswordChangePage
        currentPassword={initialPassword.currentPassword}
        onChanged={(password) => {
          setInitialPassword(null);
          setTotpPassword(password);
        }}
      />
    );
  }

  if (totpPassword !== undefined) {
    return <TotpSetupPage initialPassword={totpPassword} onComplete={() => window.location.reload()} />;
  }

  if (pathname === "/forgot-password") return <ForgotPasswordPage onBack={() => replacePath("/login")} />;
  if (pathname === "/reset-password") return <ResetPasswordPage onComplete={() => replacePath("/login")} />;

  if (!session) {
    return (
      <SignInPage
        onInitialPassword={setInitialPassword}
        onTotpSetup={setTotpPassword}
        twoFactorRequired={twoFactorRequired}
        onTwoFactorRequired={onTwoFactorRequired}
        onCancelTwoFactor={onCancelTwoFactor}
        onForgotPassword={() => replacePath("/forgot-password")}
      />
    );
  }

  const user = session.user as unknown as StaffUser;
  if (user.mustChangePassword) {
    return <InitialPasswordChangePage onChanged={(password) => setTotpPassword(password)} />;
  }
  if (!user.twoFactorEnabled) {
    return <TotpSetupPage onComplete={() => window.location.reload()} />;
  }
  if (user.role !== "Admin" && user.role !== "Kundenberater") {
    return <AuthCard><Alert severity="error">Dieses Konto ist für die Vega-Verwaltung nicht freigeschaltet.</Alert></AuthCard>;
  }
  if (!route) return <NotFoundPage onHome={() => replacePath("/")} />;

  const page = route.adminOnly && user.role !== "Admin"
    ? <Alert severity="error">Diese Route ist nur für Admins freigeschaltet.</Alert>
    : route.profile
      ? <ProfilePage user={user} />
      : route.path === "/"
        ? <OrdersPage navigate={navigatePath} />
        : route.path === "/orders/archived"
          ? <OrdersPage archived navigate={navigatePath} />
        : route.path === "/invoices"
          ? <InvoicesPage navigate={navigatePath} />
        : route.path === "/invoices/archived"
          ? <InvoicesPage archived navigate={navigatePath} />
        : route.path === "/invoices/new" || route.path === "/blanco"
          ? <InvoiceEditorPage navigate={navigatePath} />
        : route.path.startsWith("/invoices/")
          ? <InvoiceEditorPage navigate={navigatePath} id={route.path.slice("/invoices/".length)} />
        : route.path.startsWith("/edit/")
        ? <Suspense fallback={<Container sx={{ py: 8, display: "flex", justifyContent: "center" }}><CircularProgress /></Container>}>
            <OrderCreatePage navigate={navigatePath} onSaved={() => setOrderSaved(true)} onDirtyChange={setOrderDirty} {...(route.path === "/edit/-1" ? {} : { orderNumber: Number(route.path.slice("/edit/".length)) })} />
          </Suspense>
        : route.settingsArea === "options"
          ? <OptionsPage />
          : route.settingsArea === "content"
            ? <Suspense fallback={<Container sx={{ py: 8, display: "flex", justifyContent: "center" }}><CircularProgress /></Container>}>
                <ContentManagementPage route={route} navigate={navigatePath} />
              </Suspense>
            : route.settingsArea === "users"
              ? <UserManagementPage />
              : <RoutePlaceholderPage route={route} />;

  return (
    <AdminShell user={user} route={route} pathname={pathname} navigate={navigatePath} orderSaved={orderSaved} orderDirty={orderDirty}>
      {page}
    </AdminShell>
  );
}
