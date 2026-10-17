import { createContext, useCallback, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";
import { Alert, Box, Slide } from "@mui/material";
import {
  adminNotificationAutoHideDuration,
  adminNotificationReducer,
  initialAdminNotificationState,
  type AdminNotification,
  type AdminNotificationSeverity,
} from "./admin-notification-queue.js";

type Notify = (severity: AdminNotificationSeverity, message: string) => void;
const ignoreNotification: Notify = () => {};

const NotificationContext = createContext<Notify | null>(null);

export function AdminNotifications({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(adminNotificationReducer, initialAdminNotificationState);
  const nextId = useRef(0);
  const notify = useCallback<Notify>((severity, message) => {
    dispatch({ type: "enqueue", notification: { id: ++nextId.current, severity, message } });
  }, []);
  const dismiss = useCallback((id: number) => dispatch({ type: "dismiss", id }), []);

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      <Box
        aria-live="polite"
        sx={{
          position: "fixed", right: 24, bottom: 24, zIndex: (theme) => theme.zIndex.snackbar,
          display: "flex", flexDirection: "column", alignItems: "stretch", gap: 1,
          width: 400, maxWidth: "calc(100vw - 48px)", pointerEvents: "none",
        }}
      >
        {state.visible.map((notification) => (
          <NotificationToast key={notification.id} notification={notification} onDismiss={dismiss} />
        ))}
      </Box>
    </NotificationContext.Provider>
  );
}

function NotificationToast({ notification, onDismiss }: { notification: AdminNotification; onDismiss: (id: number) => void }) {
  const { id, severity, message } = notification;
  useEffect(() => {
    const duration = adminNotificationAutoHideDuration(severity);
    if (duration === null) return;
    const timer = window.setTimeout(() => onDismiss(id), duration);
    return () => window.clearTimeout(timer);
  }, [id, onDismiss, severity]);

  return (
    <Slide direction="up" in mountOnEnter>
      <Alert
        severity={severity}
        variant="filled"
        onClose={() => onDismiss(id)}
        sx={{ pointerEvents: "auto", alignItems: "center" }}
      >
        {message}
      </Alert>
    </Slide>
  );
}

export function useAdminNotification() {
  return useContext(NotificationContext) ?? ignoreNotification;
}

export function AdminAlert({ severity, children, ...props }: import("@mui/material/Alert").AlertProps) {
  const notify = useContext(NotificationContext);
  const lastMessage = useRef<string | null>(null);
  const isNotification = severity === "error" || severity === "success";
  const message = typeof children === "string" ? children : "";

  useEffect(() => {
    if (!notify || !isNotification || !message) {
      lastMessage.current = null;
      return;
    }
    const signature = `${severity}\0${message}`;
    if (lastMessage.current === signature) return;
    lastMessage.current = signature;
    notify(severity, message);
  }, [isNotification, message, notify, severity]);

  if (isNotification && notify) return null;
  return <Alert severity={severity} {...props}>{children}</Alert>;
}