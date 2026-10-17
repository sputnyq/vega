import assert from "node:assert/strict";
import { createElement, useCallback, useRef, useState } from "react";
import { act } from "react";
import test from "node:test";
import { mount } from "./dom-test-helpers.js";
import { useLocalNavigation } from "../src/use-local-navigation.js";

function NavigationHarness() {
  const dirty = useRef(false);
  const [edited, setEdited] = useState(false);
  const hasChanges = useCallback(() => dirty.current, []);
  const clear = useCallback(() => { dirty.current = false; setEdited(false); }, []);
  const { pathname, navigatePath } = useLocalNavigation(hasChanges, clear);
  return createElement("div", null,
    createElement("output", null, `${pathname}:${edited ? "dirty" : "clean"}`),
    createElement("button", { id: "edit", onClick: () => { dirty.current = true; setEdited(true); } }, "Edit"),
    createElement("button", { id: "next", onClick: () => navigatePath("/edit/1001") }, "Next"),
    createElement("button", { id: "home", onClick: () => navigatePath("/") }, "Home"),
    createElement("button", { id: "save", onClick: () => { clear(); navigatePath("/"); } }, "Save"),
  );
}

test("internal navigation preserves a rejected draft and allows leaving after saving", async () => {
  const app = await mount(createElement(NavigationHarness), "/edit/1001");
  try {
    let confirmations = 0;
    app.window.confirm = () => { confirmations++; return false; };
    await app.click(app.container.querySelector("#edit")!);
    await app.click(app.container.querySelector("#home")!);
    assert.equal(app.window.location.pathname, "/edit/1001");
    assert.equal(app.container.querySelector("output")!.textContent, "/edit/1001:dirty");
    assert.equal(confirmations, 1);
    const unload = new app.window.Event("beforeunload", { cancelable: true });
    app.window.dispatchEvent(unload);
    assert.equal(unload.defaultPrevented, true);
    await app.click(app.container.querySelector("#save")!);
    assert.equal(app.window.location.pathname, "/");
    assert.equal(confirmations, 1, "a successful save must not prompt from stale dirty state");
    const cleanUnload = new app.window.Event("beforeunload", { cancelable: true });
    app.window.dispatchEvent(cleanUnload);
    assert.equal(cleanUnload.defaultPrevented, false);
  } finally { await app.cleanup(); }
});

test("accepted navigation clears document state and cancelled back preserves forward history", async () => {
  const app = await mount(createElement(NavigationHarness));
  try {
    await app.click(app.container.querySelector("#next")!);
    await app.click(app.container.querySelector("#edit")!);
    let confirmations = 0;
    app.window.confirm = () => { confirmations++; return false; };
    const restored = new Promise<void>((resolve) => {
      let events = 0;
      const listener = () => { if (++events === 2) { app.window.removeEventListener("popstate", listener); resolve(); } };
      app.window.addEventListener("popstate", listener);
    });
    await act(async () => { app.window.history.back(); await restored; });
    assert.equal(app.window.location.pathname, "/edit/1001");
    assert.equal(app.container.querySelector("output")!.textContent, "/edit/1001:dirty");
    assert.equal(confirmations, 1);
    app.window.confirm = () => true;
    const back = new Promise<void>((resolve) => app.window.addEventListener("popstate", () => resolve(), { once: true }));
    await act(async () => { app.window.history.back(); await back; });
    assert.equal(app.container.querySelector("output")!.textContent, "/:clean");
    const forward = new Promise<void>((resolve) => app.window.addEventListener("popstate", () => resolve(), { once: true }));
    await act(async () => { app.window.history.forward(); await forward; });
    assert.equal(app.container.querySelector("output")!.textContent, "/edit/1001:clean");
  } finally { await app.cleanup(); }
});

test("additional back events during a rejected traversal still restore the original entry", async (context) => {
  const app = await mount(createElement(NavigationHarness));
  try {
    await app.click(app.container.querySelector("#next")!);
    await app.click(app.container.querySelector("#home")!);
    await app.click(app.container.querySelector("#next")!);
    await app.click(app.container.querySelector("#edit")!);
    app.window.confirm = () => false;
    const corrections: number[] = [];
    context.mock.method(app.window.history, "go", (delta?: number) => { corrections.push(delta ?? 0); });
    for (const entry of [
      { index: 2, path: "/" },
      { index: 1, path: "/edit/1001" },
      { index: 3, path: "/edit/1001" },
    ]) {
      await act(async () => {
        app.window.history.replaceState({ vegaHistoryIndex: entry.index }, "", entry.path);
        app.window.dispatchEvent(new app.window.PopStateEvent("popstate"));
      });
    }
    assert.deepEqual(corrections, [1, 2]);
    assert.equal(app.container.querySelector("output")!.textContent, "/edit/1001:dirty");
    await app.click(app.container.querySelector("#save")!);
    assert.equal(app.container.querySelector("output")!.textContent, "/:clean");
  } finally { await app.cleanup(); }
});
