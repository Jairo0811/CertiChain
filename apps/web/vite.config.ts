import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The web app calls the API with relative /api paths. In development Vite proxies them to the
// local API; in Docker the bundled nginx does the same. VITE_API_URL overrides both if set.
const apiTarget = process.env.CERTICHAIN_API_PROXY ?? "http://localhost:4000";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
      "/health": { target: apiTarget, changeOrigin: true },
    },
  },
  preview: {
    proxy: {
      "/api": { target: apiTarget, changeOrigin: true },
      "/health": { target: apiTarget, changeOrigin: true },
    },
  },
  build: {
    sourcemap: false,
  },
});
