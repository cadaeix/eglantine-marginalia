// The gallery's dev server. EGLANTINE_PALETTES may name a stylesheet of palettes, such as a built
// nuancier.css; the server reads it afresh at /palettes.css on every request, so a rebuilt sheet shows on reload.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const sheet = process.env.EGLANTINE_PALETTES;

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  server: { port: 5210 },
  plugins: [{
    name: "eglantine-palettes",
    configureServer(server) {
      server.middlewares.use("/palettes.css", (_request, response) => {
        if (!sheet) { response.statusCode = 404; response.end(); return; }
        response.setHeader("Content-Type", "text/css; charset=utf-8");
        response.end(readFileSync(sheet));
      });
    },
  }],
});
