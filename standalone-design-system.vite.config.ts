import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: resolve(".standalone"),
  publicDir: false,
  base: "./",
  plugins: [react()],
  build: {
    outDir: resolve("standalone-design-system-dist"),
    emptyOutDir: true,
    cssCodeSplit: false,
    target: "es2020",
    rollupOptions: {
      input: resolve(".standalone/design-system.html"),
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
