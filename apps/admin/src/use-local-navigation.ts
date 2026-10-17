import { useCallback, useEffect, useRef, useState } from "react";

const LEAVE_MESSAGE = "Ungespeicherte Änderungen verwerfen und die Seite verlassen?";
const HISTORY_INDEX = "vegaHistoryIndex";

export function useLocalNavigation(hasUnsavedChanges: () => boolean, onLeave: () => void) {
  const [pathname, setPathname] = useState(() => window.location.pathname);
  const index = useRef(0);
  const restoring = useRef<number | null>(null);
  const confirmLeave = useCallback(() => !hasUnsavedChanges() || window.confirm(LEAVE_MESSAGE), [hasUnsavedChanges]);

  useEffect(() => {
    const savedIndex: unknown = window.history.state?.[HISTORY_INDEX];
    index.current = typeof savedIndex === "number" ? savedIndex : 0;
    window.history.replaceState({ ...window.history.state, [HISTORY_INDEX]: index.current }, "");
    const popState = () => {
      const nextIndex: unknown = window.history.state?.[HISTORY_INDEX];
      if (restoring.current !== null) {
        if (nextIndex === restoring.current) restoring.current = null;
        else if (typeof nextIndex === "number") window.history.go(restoring.current - nextIndex);
        return;
      }
      if (typeof nextIndex !== "number") return;
      if (!confirmLeave()) {
        restoring.current = index.current;
        window.history.go(index.current - nextIndex);
        return;
      }
      index.current = nextIndex;
      onLeave();
      setPathname(window.location.pathname);
    };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges()) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("popstate", popState);
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      window.removeEventListener("popstate", popState);
      window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [confirmLeave, hasUnsavedChanges, onLeave]);

  const replacePath = useCallback((path: string) => {
    if (window.location.pathname === path) return;
    onLeave();
    window.history.replaceState({ ...window.history.state, [HISTORY_INDEX]: index.current }, "", path);
    setPathname(path);
  }, [onLeave]);

  const navigatePath = useCallback((path: string) => {
    if (window.location.pathname === path || !confirmLeave()) return;
    onLeave();
    window.history.pushState({ [HISTORY_INDEX]: ++index.current }, "", path);
    setPathname(path);
  }, [confirmLeave, onLeave]);

  return { pathname, replacePath, navigatePath, confirmLeave };
}
