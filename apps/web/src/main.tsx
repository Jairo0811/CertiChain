import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/ibm-plex-sans/400.css";
import "@fontsource/ibm-plex-sans/500.css";
import "@fontsource/ibm-plex-sans/600.css";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource-variable/source-serif-4/index.css";
import { App } from "./App";
import { ToastProvider } from "./components/ui/Toast";
import { PublicVerifyPage } from "./pages/PublicVerifyPage";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import "./styles/layout.css";
import "./styles/pages.css";

// /verify (and /verify/) is the public, unauthenticated verifier; links and QR codes depend on it.
const isPublicVerification = /^\/verify\/?$/.test(window.location.pathname);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {isPublicVerification ? (
      <ToastProvider>
        <PublicVerifyPage />
      </ToastProvider>
    ) : (
      <App />
    )}
  </React.StrictMode>,
);
