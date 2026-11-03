import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  base: "./",
  build: {
    outDir: "../site-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        playground: fileURLToPath(new URL("index.html", import.meta.url)),
        specimens: fileURLToPath(new URL("specimens.html", import.meta.url)),
      },
    },
  },
});
