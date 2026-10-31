import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const backend = process.env.WANDER_BACKEND_URL || "http://127.0.0.1:5001";
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      "/api": backend,
      "/media": backend,
    },
  },
});
