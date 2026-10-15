export type AdminNotificationSeverity = "error" | "success" | "warning";

export interface AdminNotification {
  id: number;
  severity: AdminNotificationSeverity;
  message: string;
}

export interface AdminNotificationState {
  current: AdminNotification | null;
  queued: AdminNotification[];
}

export type AdminNotificationAction =
  | { type: "enqueue"; notification: AdminNotification }
  | { type: "dismiss" };

export const initialAdminNotificationState: AdminNotificationState = {
  current: null,
  queued: [],
};

export function adminNotificationReducer(
  state: AdminNotificationState,
  action: AdminNotificationAction,
): AdminNotificationState {
  if (action.type === "enqueue") {
    return state.current
      ? { ...state, queued: [...state.queued, action.notification] }
      : { ...state, current: action.notification };
  }

  const [current = null, ...queued] = state.queued;
  return { current, queued };
}

export function adminNotificationAutoHideDuration(severity: AdminNotificationSeverity) {
  return severity === "success" ? 3_000 : null;
}