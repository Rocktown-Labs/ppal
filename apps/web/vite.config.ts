import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), tanstackStart(), viteReact()],
  resolve: {
    tsconfigPaths: true,
  },
  server: {
    port: 3001,
    proxy: {
      // Development browsers must reach the API same-origin. Modern browsers
      // block cross-site cookies, and `localhost` (the page) and `127.0.0.1`
      // (the Worker bind) count as different sites — so a direct API base
      // would silently drop the Better Auth session cookie. The proxy keeps
      // cookies first-party. `ws` forwards community chat WebSocket
      // upgrades.
      "/api": {
        changeOrigin: true,
        target: "http://127.0.0.1:3000",
        ws: true,
      },
    },
  },
});
