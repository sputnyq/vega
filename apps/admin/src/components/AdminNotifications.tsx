import { createContext, useCallback, useContext, useEffect, useReducer, useRef, type ReactNode } from "react";
import { Alert, Snackbar } from "@mui/material";
import {
  adminNotificationAutoHideDuration,
  adminNotificationReducer,
  initialAdminNotificationState,
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
  const dismiss = useCallback(() => dispatch({ type: "dismiss" }), []);
  const current = state.current;

  return (
    <NotificationContext.Provider value={notify}>
      {children}
      <Snackbar
        key={current?.id}
        open={current !== null}
        autoHideDuration={current ? adminNotificationAutoHideDuration(current.severity) : null}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        onClose={(_event, reason) => {
          if (current?.severity === "success" && reason !== "clickaway") dismiss();
        }}
      >
        {current ? (
          <Alert severity={current.severity} variant="filled" onClose={dismiss}>
            {current.message}
          </Alert>
        ) : <span />}
      </Snackbar>
    </NotificationContext.Provider>
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