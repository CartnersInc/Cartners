import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// When connected to the real backend, /api requests go to the Python server.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:8000" } },
});
