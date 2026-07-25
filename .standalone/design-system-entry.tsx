import React from "react";
import { createRoot } from "react-dom/client";
import DesignSystemPage from "../app/design-system/page";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DesignSystemPage />
  </React.StrictMode>,
);
