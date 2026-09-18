import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [react(), cloudflare()],
  resolve: {
    alias: {
      "@": "/src",
    },
  },
  server: {
    // Allows testing short-link domains locally via `curl -H "Host: go.example.com"`.
    allowedHosts: true,
  },
});
