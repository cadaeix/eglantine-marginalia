import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  base: "./",
  build: {
    outDir: "../site-dist",
    emptyOutDir: true,
    // Vite would inline the smallest guest figures into the playground's script, for every visitor on every day;
    // as files, each engraving loads only on its own day.
    assetsInlineLimit: 0,
    rollupOptions: {
      input: {
        playground: fileURLToPath(new URL("index.html", import.meta.url)),
        specimens: fileURLToPath(new URL("specimens.html", import.meta.url)),
      },
    },
  },
});
