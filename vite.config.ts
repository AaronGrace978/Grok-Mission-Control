import path from "node:path";
import process from "node:process";
import { defineConfig, type ProxyOptions } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const host = process.env.TAURI_DEV_HOST;

// Browser mode talks to xAI through this proxy so the API key never hits a CORS wall.
// Origin/Referer are stripped so the upstream sees a plain server-to-server request.
const xaiProxy: Record<string, ProxyOptions> = {
  "/api/xai": {
    target: "https://api.x.ai",
    changeOrigin: true,
    secure: true,
    rewrite: (p) => p.replace(/^\/api\/xai/, ""),
    configure: (proxy) => {
      proxy.on("proxyReq", (proxyReq) => {
        proxyReq.removeHeader("origin");
        proxyReq.removeHeader("referer");
      });
    },
  },
};

export default defineConfig(() => ({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "./src") },
  },
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || "127.0.0.1",
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: { ignored: ["**/src-tauri/**"] },
    proxy: xaiProxy,
  },
  preview: {
    port: 1430,
    host: "127.0.0.1",
    proxy: xaiProxy,
  },
  build: {
    target: "es2021",
    chunkSizeWarningLimit: 2500,
  },
}));
