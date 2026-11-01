// The gallery's dev server. EGLANTINE_PALETTES may name palette stylesheets, separated as in PATH: for
// nuancier, its nuancier.css and then its Églantine port, ports/eglantine/nuancier.css, which sets the four
// inks for every palette. The server joins and reads them afresh at /palettes.css on every request, so a
// rebuilt sheet shows on reload.
import { readFileSync } from "node:fs";
import { delimiter } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const sheets = (process.env.EGLANTINE_PALETTES ?? "").split(delimiter).filter(Boolean);
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  server: { port: 5210 },
  plugins: [{
    name: "eglantine-palettes",
    configureServer(server) {
      server.middlewares.use("/palettes.css", (_request, response) => {
        if (sheets.length === 0) { response.statusCode = 404; response.end(); return; }
        response.setHeader("Content-Type", "text/css; charset=utf-8");
        response.end(sheets.map(sheet => readFileSync(sheet, "utf8")).join("\n"));
      });
    },
  }],
});
