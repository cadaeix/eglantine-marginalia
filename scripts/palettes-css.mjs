// Writes dist/palettes.css from the built palettes, as the last step of `npm run build`.
import { writeFileSync } from "node:fs";
import { palettesCss } from "../dist/palettes.js";

writeFileSync(new URL("../dist/palettes.css", import.meta.url), palettesCss());
