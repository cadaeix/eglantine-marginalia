// Grows every calendar plant and every form example across sizes, layouts and festivals, draws each at two moments,
// and reports every garden that throws: which plant, at which sizes, and where. It exits with 1 if any did.
// See scripts/README.md.
import { parseArgs } from "node:util";
import { PLANTS } from "../src/calendar/index.js";
import { type Festival, FESTIVALS, FORM_MODULES, growGarden, type GrowSpec, ORNAMENTS, renderGarden, type Variant } from "../src/index.js";

const LAYOUTS = ["column", "page", "hanging", "bandeau", "cul-de-lampe"] as const;
type Layout = typeof LAYOUTS[number];
/** The heights a column is grown at unless --heights says otherwise: very short, short, the forms' own, and tall. */
const COLUMN_HEIGHTS = [4, 8, 14, 22, 30];
/** The page a garden reaches round, in centimetres, with its room below the text kept inside the column. */
const PAGE = { text: 12, below: 9 };
/** The moments each garden is drawn at: early in a quiet day, and the end of a full one. */
const MOMENTS = [0.3, 1];

const { values } = parseArgs({
  options: {
    layout: { type: "string", default: "column" },
    heights: { type: "string" },
    widths: { type: "string" },
    seeds: { type: "string", default: "1,1793" },
    festival: { type: "string" },
    form: { type: "string" },
  },
});

const numbers = (text: string): number[] => text.split(",").map(Number);
const layouts = values.layout.split(",").map(name => {
  if (!(LAYOUTS as readonly string[]).includes(name)) throw new RangeError(`--layout takes ${LAYOUTS.join(", ")}, not ${name}`);
  return name as Layout;
});
const festivals: (Festival | undefined)[] = values.festival === undefined ? [undefined] : values.festival.split(",").map(name => {
  if (name === "none") return undefined;
  if (!(FESTIVALS as readonly string[]).includes(name)) throw new RangeError(`--festival takes none, ${FESTIVALS.join(", ")}, not ${name}`);
  return name as Festival;
});
const forms = values.form?.split(",");
const seeds = numbers(values.seeds);

const plants: { name: string; form: string; variant: Variant }[] = [
  ...PLANTS.map(row => ({ name: row.name, form: row.form, variant: row.variant })),
  ...[...FORM_MODULES.values()].flatMap(module => module.examples.map(example => ({ name: `${module.id}: ${example.name}`, form: module.id, variant: example.variant }))),
].filter(plant => !forms || forms.includes(plant.form));

let failed = false;
for (const layout of layouts) {
  const ornament = layout === "bandeau" || layout === "cul-de-lampe" ? layout : null;
  // A band is grown at its own size unless told otherwise; a column at a range of heights and its own width.
  const heights = values.heights ? numbers(values.heights) : ornament ? [ORNAMENTS[ornament].height] : COLUMN_HEIGHTS;
  const widths = values.widths ? numbers(values.widths) : [ornament ? ORNAMENTS[ornament].width : 6];
  for (const festival of festivals) {
    const failures = new Map<string, { sizes: Set<string>; errors: Map<string, string> }>();
    const started = Date.now();
    let grown = 0;
    for (const plant of plants) for (const height of heights) for (const width of widths) for (const seed of seeds) {
      const spec: GrowSpec = { seed, form: plant.form, variant: plant.variant, width, height };
      if (ornament) spec.ornament = ornament;
      if (layout === "page") spec.page = { side: seed % 2 === 1 ? "left" : "right", text: PAGE.text, below: Math.min(height, PAGE.below) };
      if (festival) spec.festival = festival;
      grown += 1;
      try {
        const garden = growGarden(spec);
        for (const t of MOMENTS) renderGarden(garden, { t, fullness: t }, { manner: "lavis", id: "sweep", scale: 10, hanging: layout === "hanging" });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const where = error instanceof Error ? error.stack?.split("\n")[1]?.trim() ?? "" : "";
        const key = `${plant.name} (${plant.form})`;
        const entry = failures.get(key) ?? { sizes: new Set(), errors: new Map() };
        entry.sizes.add(`${width} × ${height}${seeds.length > 1 ? ` seed ${seed}` : ""}`);
        entry.errors.set(message, where);
        failures.set(key, entry);
      }
    }
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    console.log(`${layout}${festival ? ` with ${festival}` : ""}: ${grown} gardens in ${seconds} s, ${failures.size} plants throwing`);
    for (const [key, { sizes, errors }] of failures) {
      console.log(`  ${key}: ${[...sizes].join(", ")}`);
      for (const [message, where] of errors) console.log(`    ${message}  ${where}`);
    }
    if (failures.size > 0) failed = true;
  }
}
process.exitCode = failed ? 1 : 0;
