import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import { PublicVerify } from "./PublicVerify";
import "./styles.css";
import "./fontawesome-icons.css";
import "./branding.css";
import "./pdf-certificate.css";

const isPublicVerification = window.location.pathname === "/verify";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isPublicVerification ? <PublicVerify /> : <App />}
  </React.StrictMode>,
);
