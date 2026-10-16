import { JSDOM } from "jsdom";
import * as React from "react";
import { after } from "node:test";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "https://vega.example.test/",
  pretendToBeVisual: true,
});
const { window } = dom;
window.matchMedia = (query: string) => ({
  matches: false, media: query, onchange: null,
  addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {},
  dispatchEvent: () => true,
});
window.HTMLElement.prototype.scrollIntoView = () => {};
const globals: Record<string, unknown> = {
  window, document: window.document, navigator: window.navigator,
  HTMLElement: window.HTMLElement, HTMLInputElement: window.HTMLInputElement,
  HTMLTextAreaElement: window.HTMLTextAreaElement, Element: window.Element,
  Node: window.Node, Document: window.Document, DocumentFragment: window.DocumentFragment,
  SVGElement: window.SVGElement, ShadowRoot: window.ShadowRoot,
  Event: window.Event, MouseEvent: window.MouseEvent, KeyboardEvent: window.KeyboardEvent,
  PopStateEvent: window.PopStateEvent, MutationObserver: window.MutationObserver,
  getComputedStyle: window.getComputedStyle.bind(window),
  history: window.history, location: window.location, React,
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  IS_REACT_ACT_ENVIRONMENT: true,
};
const previous = new Map(Object.keys(globals).map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
for (const [key, value] of Object.entries(globals)) {
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
}
after(() => {
  window.close();
  for (const [key, descriptor] of previous) {
    if (descriptor) Object.defineProperty(globalThis, key, descriptor);
    else Reflect.deleteProperty(globalThis, key);
  }
});
const { createRoot } = await import("react-dom/client");

export async function mount(element: React.ReactNode, path = "/") {
  window.history.replaceState(null, "", path);
  window.confirm = () => true;
  const container = window.document.createElement("div");
  window.document.body.appendChild(container);
  const root = createRoot(container);
  await React.act(async () => root.render(element));
  return {
    window,
    container,
    async render(next: React.ReactNode) {
      await React.act(async () => root.render(next));
    },
    async click(target: Element) {
      await React.act(async () => target.dispatchEvent(new window.MouseEvent("click", { bubbles: true })));
    },
    async input(target: HTMLInputElement | HTMLTextAreaElement, value: string) {
      const prototype = target.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(target, value);
      await React.act(async () => target.dispatchEvent(new window.Event("input", { bubbles: true })));
    },
    async flush() {
      await React.act(async () => { await new Promise<void>((resolve) => setImmediate(resolve)); });
    },
    async cleanup() {
      await React.act(async () => root.unmount());
      // Tiptap defers editor destruction by one timer tick.
      await React.act(async () => { await new Promise<void>((resolve) => setTimeout(resolve, 5)); });
      container.remove();
    },
  };
}
