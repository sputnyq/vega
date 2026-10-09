import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.js";
import { setApiBase } from "./api.js";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/700.css";
import "./styles.css";

const root = document.getElementById("vega-customer-form") ?? document.getElementById("root");
if (!root) throw new Error("Vega customer form mount point is missing.");
setApiBase(root.dataset.apiBase ?? "");
ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
