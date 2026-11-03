import { calendarDay, figureURL, republicanDate, type CalendarGuest } from "../src/calendar/index.js";
import type { Variant } from "../src/form.js";
import { growGarden, type Garden } from "../src/grow.js";
import { withInks } from "../src/inks.js";
import type { Manner } from "../src/paint.js";
import { PALETTES, paletteInks } from "../src/palettes.js";
import { renderGarden } from "../src/render.js";
import { FORM_LABELS, PLANTS } from "./catalog.js";

export interface PlaygroundState {
  source: "plants" | "calendar";
  plant: string;
  date: string;
  seed: number;
  manner: Manner;
  palette: string;
  reading: "light" | "dark";
  t: number;
  fullness: number;
  side: "left" | "right";
  margin: number;
}

export interface Selection {
  name: string;
  subtitle: string;
  description: string;
  dateline: string;
  form: string | null;
  variant: Variant;
  guest: CalendarGuest | null;
}

export interface GardenPreview {
  selection: Selection;
  garden: Garden | null;
}

type StateInput = { [Key in keyof PlaygroundState]?: unknown };

const PROVENANCE_URL = "https://github.com/cadaeix/eglantine-marginalia/blob/main/figures/PROVENANCE.md";
const BIU_FIGURES: Readonly<Record<string, true>> = {
  chevreuil: true, lapin: true, chat: true, lievre: true, chamois: true, loutre: true,
};

function validDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  try {
    republicanDate(value);
    return true;
  } catch {
    return false;
  }
}

function today(): string {
  const now = new Date();
  return `${String(now.getFullYear()).padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function defaultState(date = today()): PlaygroundState {
  return {
    source: "plants", plant: "rose", date: validDate(date) ? date : today(), seed: 1793,
    manner: "lavis", palette: "iron-gall", reading: "light", t: 0.68, fullness: 0.65,
    side: "right", margin: 32,
  };
}

function numeric(value: unknown, fallback: number, min: number, max: number, integer = false): number {
  const number = typeof value === "number" ? value
    : typeof value === "string" && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu.test(value) ? Number(value) : NaN;
  return Number.isFinite(number) && number >= min && number <= max && (!integer || Number.isSafeInteger(number)) ? number : fallback;
}

function normalize(input: StateInput, fallback: PlaygroundState): PlaygroundState {
  return {
    source: input.source === "plants" || input.source === "calendar" ? input.source : fallback.source,
    plant: typeof input.plant === "string" && PLANTS.some(plant => plant.id === input.plant) ? input.plant : fallback.plant,
    date: validDate(input.date) ? input.date : fallback.date,
    seed: numeric(input.seed, fallback.seed, 0, 0xffff_ffff, true),
    manner: input.manner === "lavis" || input.manner === "taille-douce" ? input.manner : fallback.manner,
    palette: typeof input.palette === "string" && PALETTES.some(palette => palette.id === input.palette) ? input.palette : fallback.palette,
    reading: input.reading === "light" || input.reading === "dark" ? input.reading : fallback.reading,
    t: numeric(input.t, fallback.t, 0, 1),
    fullness: numeric(input.fullness, fallback.fullness, 0, 1),
    side: input.side === "left" || input.side === "right" ? input.side : fallback.side,
    margin: numeric(input.margin, fallback.margin, 22, 42, true),
  };
}

export function readState(hash: string, fallback = defaultState()): PlaygroundState {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  return normalize({
    source: params.get("source"), plant: params.get("plant"), date: params.get("date"), seed: params.get("seed"),
    manner: params.get("manner"), palette: params.get("palette"), reading: params.get("reading"),
    t: params.get("t"), fullness: params.get("fullness"), side: params.get("side"), margin: params.get("margin"),
  }, normalize(fallback, defaultState()));
}

export function stateHash(state: PlaygroundState): string {
  const value = normalize(state, defaultState());
  return `#${new URLSearchParams({
    source: value.source, plant: value.plant, date: value.date, seed: String(value.seed),
    manner: value.manner, palette: value.palette, reading: value.reading,
    t: String(value.t), fullness: String(value.fullness), side: value.side, margin: String(value.margin),
  })}`;
}

export function resolveSelection(state: PlaygroundState): Selection {
  const value = normalize(state, defaultState());
  if (value.source === "plants") {
    const plant = PLANTS.find(candidate => candidate.id === value.plant)!;
    return {
      name: plant.name, subtitle: plant.french, description: plant.description, dateline: "Curated plant",
      form: plant.form, variant: plant.variant, guest: null,
    };
  }
  const day = calendarDay(value.date);
  if (!day.plant) return {
    name: "A day without a plant", subtitle: day.name,
    description: "The complementary days fall outside the calendar's twelve months. These days have no named plant or garden.",
    dateline: day.dateline, form: null, variant: {}, guest: null,
  };
  const name = Object.hasOwn(FORM_LABELS, day.plant.form) ? FORM_LABELS[day.plant.form]! : day.plant.form;
  const description = day.kind === "plant"
    ? `The calendar names this day ${day.name}. The garden uses the ${name.toLowerCase()} form.`
    : `The calendar names this day ${day.name}. The garden uses the preceding day's plant, ${day.plant.name}. `
      + (day.guest ? "A historical engraving supplies the day's guest." : "The library has no engraving for this day's guest.");
  return {
    name, subtitle: day.name, description, dateline: day.dateline,
    form: day.plant.form, variant: day.plant.variant, guest: day.guest,
  };
}

export function createGarden(state: PlaygroundState): GardenPreview {
  const value = normalize(state, defaultState());
  const selection = resolveSelection(value);
  const garden = selection.form === null ? null : growGarden({
    seed: value.seed, form: selection.form, variant: selection.variant,
    ...(selection.guest ? { guest: selection.guest } : {}),
  });
  return { selection, garden };
}

function escapeXml(text: string): string {
  return text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;").replace(/'/gu, "&apos;");
}

function guestCredit(guest: CalendarGuest): string {
  const credit = Object.hasOwn(BIU_FIGURES, guest.figure)
    ? "Buffon, Histoire naturelle; original engraving public domain. Scan: Bibliothèque interuniversitaire de santé, Paris (BIU Santé), Etalab Open Licence."
    : "Original historical engraving public domain. The source scan and its terms are listed in the figure provenance.";
  return `${guest.name} (${guest.figure}.png). ${credit} Mask prepared by cropping and thresholding the scan. ${PROVENANCE_URL}`;
}

async function figureDataUri(guest: CalendarGuest): Promise<string> {
  const response = await fetch(figureURL(guest.figure));
  if (!response.ok) throw new Error(`Could not load ${guest.figure}.png: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)));
  }
  return `data:image/png;base64,${btoa(chunks.join(""))}`;
}

export async function exportSvg(state: PlaygroundState): Promise<string> {
  const value = normalize(state, defaultState());
  const { selection, garden } = createGarden(value);
  if (!garden) throw new Error("Complementary days have no plant to export.");
  const guestFigure = selection.guest ? await figureDataUri(selection.guest) : null;
  const id = `playground-${value.seed}`;
  const inks = paletteInks(value.palette, value.reading);
  const svg = withInks(renderGarden(garden, { t: value.t, fullness: value.fullness }, {
    manner: value.manner, id, scale: 32, ...(guestFigure ? { guestFigure } : {}),
  }), inks);
  const attribution = selection.guest ? guestCredit(selection.guest) : "";
  const description = [selection.subtitle, selection.dateline, selection.description, attribution].filter(Boolean).join(" ");
  const metadata = JSON.stringify({ generator: "Églantine", state: value, attribution });
  return svg.replace(/>/u, () => ` aria-labelledby="${id}-title ${id}-description">`
    + `<title id="${id}-title">${escapeXml(selection.name)}</title>`
    + `<desc id="${id}-description">${escapeXml(description)}</desc>`
    + `<metadata>${escapeXml(metadata)}</metadata>`
    + `<rect width="100%" height="100%" fill="${inks.paper}"/>`);
}

export function usageCode(state: PlaygroundState): string {
  const value = normalize(state, defaultState());
  const selection = resolveSelection(value);
  const quote = JSON.stringify;
  if (selection.form === null) return [
    'import { calendarDay } from "eglantine-marginalia/calendar";',
    "", `const day = calendarDay(${quote(value.date)});`,
    'document.body.textContent = `${day.dateline}: no plant on a complementary day.`;',
  ].join("\n");
  const lines = [
    'import { growGarden, renderGarden, paletteInks, withInks } from "eglantine-marginalia";',
  ];
  if (value.source === "calendar") lines.push(
    `import { calendarDay${selection.guest ? ", figureURL" : ""} } from "eglantine-marginalia/calendar";`,
    "", `const day = calendarDay(${quote(value.date)});`,
    'if (!day.plant) throw new Error("No plant on a complementary day.");',
    `const garden = growGarden({ seed: ${value.seed}, ...day.plant,`,
    "  ...(day.guest ? { guest: day.guest } : {}) });",
  );
  else lines.push("", "const garden = growGarden({", `  seed: ${value.seed}, form: ${quote(selection.form)},`,
    `  variant: ${quote(selection.variant)},`, "});");
  lines.push(
    `const inks = paletteInks(${quote(value.palette)}, ${quote(value.reading)});`,
    `const svg = withInks(renderGarden(garden, { t: ${value.t}, fullness: ${value.fullness} }, {`,
    `  manner: ${quote(value.manner)}, id: ${quote(`playground-${value.seed}`)}, scale: 32,`,
  );
  if (selection.guest) lines.push(
    "  ...(day.guest ? { guestFigure: figureURL(day.guest.figure).href } : {}),",
  );
  lines.push(
    "}), inks);", "", 'const margin = document.createElement("aside");',
    `Object.assign(margin.style, { float: ${quote(value.side)}, width: ${quote(`${value.margin}%`)}, background: inks.paper });`,
    "margin.innerHTML = svg;", "document.body.append(margin);",
  );
  if (selection.guest) lines.push("", "// Inline SVG can use the figure URL; downloaded SVG needs a PNG data URI.",
    `// Figure attribution: ${guestCredit(selection.guest)}`);
  return lines.join("\n");
}
