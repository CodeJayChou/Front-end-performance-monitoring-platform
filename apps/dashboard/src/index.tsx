import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "@fontsource-variable/noto-sans-sc/wght.css";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root");

if (!root) throw new Error("Dashboard root element is missing");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
