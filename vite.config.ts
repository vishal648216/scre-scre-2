import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(({ mode }) => {
  const isDev = mode === "development";
  return {
    define: {
      // i18next only suppresses the Locize console.info when this env is set OR NODE_ENV is production;
      // Vite client bundles often omit process.env, so set explicitly.
      "process.env.I18NEXT_NO_SUPPORT_NOTICE": JSON.stringify("1"),
    },
    server: isDev
      ? {
          host: true,
          port: 8085,
          allowedHosts: ["screduc.com", "www.screduc.com"],
          proxy: {
            "/api": {
              target: "http://localhost:3008",
              changeOrigin: true,
            },
            "/uploads": {
              target: "http://localhost:3008",
              changeOrigin: true,
            },
          },
        }
      : undefined,
    preview: {
      host: true,
      port: 8085,
      allowedHosts: ["screduc.com", "www.screduc.com"],
      proxy: {
        "/api": {
          target: "http://localhost:3008",
          changeOrigin: true,
        },
        "/uploads": {
          target: "http://localhost:3008",
          changeOrigin: true,
        },
      },
    },
    plugins: [react()],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
      dedupe: [
        "react",
        "react-dom",
        "react-dom/client",
        "react-router-dom",
        "react-i18next",
        "i18next",
        "@tanstack/react-query",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react-router-dom",
        "react-i18next",
        "i18next",
        "@tanstack/react-query",
        "lucide-react",
        "framer-motion",
      ],
    },
    build: {
      modulePreload: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (
              id.includes("node_modules/react/") ||
              id.includes("node_modules/react-dom/") ||
              id.includes("node_modules/react-router/") ||
              id.includes("node_modules/react-router-dom/") ||
              id.includes("node_modules/@tanstack/") ||
              id.includes("node_modules/i18next/") ||
              id.includes("node_modules/react-i18next/") ||
              id.includes("node_modules/scheduler/") ||
              id.includes("node_modules/use-sync-external-store/")
            ) {
              return "react-vendor";
            }
            if (id.includes("node_modules")) {
              return "vendor";
            }
          },
        },
      },
      chunkSizeWarningLimit: 3000,
    },
  };
});
