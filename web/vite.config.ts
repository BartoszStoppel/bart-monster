import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath, URL } from "node:url";
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      next: fileURLToPath(new URL("./src/compat", import.meta.url)),
      "@supabase/supabase-js": fileURLToPath(
        new URL("./src/compat/database-types.ts", import.meta.url),
      ),
    },
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8080",
      "/_next/image": "http://127.0.0.1:8080",
      "/callback": "http://127.0.0.1:8080",
      "/logout": "http://127.0.0.1:8080",
      "/login/google": "http://127.0.0.1:8080",
    },
  },
  build: { sourcemap: false },
});
