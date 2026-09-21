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
          // Disable HMR to prevent periodic reloads in production-like environments
          hmr: false,
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
    },
    build: {
      // Avoid dozens of tiny vendor-* chunks (e.g. vendor-lucide-react-*.js). Stale cached index.html
      // pointing at old hashes causes "MIME type text/html" when the server falls back to SPA HTML.
      modulePreload: false,
      rollupOptions: {
        output: {
          manualChunks(id) {
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
