// The playground's settings, as the URL keeps them, and the garden they grow on the measured page: its
// selection and text, its SVG for saving, and the code that grows it on another website.
import { calendarDay, type CalendarGuest, DAYS, figureURL, nameFromArticle, republicanDate } from "../src/calendar/index.js";
import type { Festival } from "../src/festival.js";
import type { Variant } from "../src/form.js";
import { num } from "../src/geometry.js";
import { type Garden, growGarden } from "../src/grow.js";
import { withInks } from "../src/inks.js";
import type { Manner } from "../src/paint.js";
import { PALETTES, paletteInks } from "../src/palettes.js";
import { renderGarden } from "../src/render.js";
import { FORM_PHRASES, PLANTS } from "./catalog.js";
import { ENGLISH_COMPLEMENTARY, ENGLISH_DAYS } from "./english.js";

/** How the garden sits on the page: up its margin, round the text, or hanging from the top of the margin. */
export type Mode = "margin" | "page" | "hanging";

export interface PlaygroundState {
  source: "calendar" | "plants";
  plant: string;
  date: string;
  seed: number;
  manner: Manner;
  palette: string;
  reading: "light" | "dark";
  t: number;
  fullness: number;
  mode: Mode;
  side: "left" | "right";
}

/** The page the garden grows on, measured from the playground's layout, in centimetres. */
export interface Geometry {
  /** The margin column's width and height. */
  column: number;
  height: number;
  /** The text's width beside the column, and the room under its last line. */
  text: number;
  below: number;
}

export interface Selection {
  /** The heading: a chosen plant's English name, or the calendar day's own name. */
  title: string;
  /** The heading's other language: a chosen plant's French name, a calendar day's English one. */
  gloss: string;
  /** The calendar's date for the day, or nothing for a chosen plant. */
  dateline: string;
  /** What the garden draws. */
  about: string;
  form: string;
  variant: Variant;
  guest: CalendarGuest | null;
  /** A complementary day's festival, done to the year's last plant. */
  festival: Festival | null;
}

export interface GardenPreview {
  selection: Selection;
  garden: Garden;
}

type StateInput = { [Key in keyof PlaygroundState]?: unknown };

/** Pixels per centimetre of a saved SVG. */
const SAVED_SCALE = 32;
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

export function today(): string {
  const now = new Date();
  return `${String(now.getFullYear()).padStart(4, "0")}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
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
    mode: input.mode === "margin" || input.mode === "page" || input.mode === "hanging" ? input.mode : fallback.mode,
    side: input.side === "left" || input.side === "right" ? input.side : fallback.side,
  };
}

/** The settings a visitor first sees: today's plant from the calendar, growing round the text. */
export function defaultState(overrides: Partial<PlaygroundState> = {}): PlaygroundState {
  return normalize(overrides, {
    source: "calendar", plant: "rose", date: today(), seed: 1793, manner: "lavis", palette: "iron-gall", reading: "light",
    t: 0.7, fullness: 0.65, mode: "page", side: "right",
  });
}

export function readState(hash: string, fallback = defaultState()): PlaygroundState {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
  const input: StateInput = {};
  for (const key of Object.keys(fallback) as (keyof PlaygroundState)[]) input[key] = params.get(key);
  return normalize(input, normalize(fallback, defaultState()));
}

export function stateHash(state: PlaygroundState): string {
  const value = normalize(state, defaultState());
  return `#${new URLSearchParams(Object.entries(value).map(([key, setting]) => [key, String(setting)]))}`;
}

/** A calendar day's place in the year, from 0 on 1er vendémiaire. */
const dayIndex = (date: { month: number; day: number }): number => (date.month - 1) * 30 + date.day - 1;
const capital = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
/** What each festival does to the year's last plant, le marron, after "and" in a day's description. */
const FESTIVAL_PHRASES: Readonly<Record<Festival, string>> = {
  vertu: "the festival of Virtue strips it to its stem, without flower or leaf, and leaves its burrs empty.",
  genie: "the festival of Genius plants a quill in its empty burr, and the chestnut twines up the pen.",
  travail: "the festival of Labour cuts it and binds it in a sheaf: the year's harvest, with no tool beside it.",
  opinion: "the festival of Opinion lets the margin say what it likes about it, in caricatures, moustaches and scrawl, the more as the day fills.",
  recompenses: "the festival of Rewards braids it with oak into a civic crown, tied with a ribbon.",
  revolution: "the festival of the Revolution, which falls only in a sextile year, leaves a single chestnut in the middle of the page, and towards evening its root comes out.",
};

/**
 * A day of the year starting at `from`, which holds every day of the calendar, chosen with `random`: one named
 * for a plant, or one whose animal or tool has an engraving to visit the garden. `except` is never chosen.
 */
export function randomDay(kind: "plant" | "visitor", from: string, random: () => number, except = ""): string {
  const [year, month, day] = from.split("-").map(Number) as [number, number, number];
  const days: string[] = [];
  for (let offset = 0; offset < 366; offset += 1) {
    const date = new Date(Date.UTC(year, month - 1, day + offset)).toISOString().slice(0, 10);
    const entry = calendarDay(date);
    if (date !== except && (kind === "plant" ? entry.kind === "plant" : entry.guest !== null)) days.push(date);
  }
  return days[Math.floor(random() * days.length)]!;
}

export function resolveSelection(state: PlaygroundState): Selection {
  const value = normalize(state, defaultState());
  if (value.source === "plants") {
    const plant = PLANTS.find(candidate => candidate.id === value.plant)!;
    return { title: plant.name, gloss: plant.french, dateline: "", about: plant.description, form: plant.form, variant: plant.variant, guest: null, festival: null };
  }
  const day = calendarDay(value.date);
  if (day.date.complementary) {
    // The calendar gives every complementary day its festival.
    const festival = day.festival!;
    const english = ENGLISH_DAYS[DAYS.findIndex(article => nameFromArticle(article) === day.plant.name)]!;
    return {
      title: capital(day.name), gloss: `the day of ${ENGLISH_COMPLEMENTARY[day.date.day - 1]!}`, dateline: day.dateline,
      about: `The complementary days fall at the end of the year, outside its twelve months, and are named for festivals rather than plants. The garden grows the year's last plant, ${day.plant.name}, ${english}, and ${FESTIVAL_PHRASES[festival]}`,
      form: day.plant.form, variant: day.plant.variant, guest: null, festival,
    };
  }
  const index = dayIndex(day.date);
  const english = ENGLISH_DAYS[index]!;
  const drawn = `The garden draws it as ${FORM_PHRASES[day.plant.form] ?? day.plant.form}.`;
  let about: string;
  if (day.kind === "plant") about = `The calendar gives this day to ${day.name}, ${english}. ${drawn}`;
  else {
    const plant = `${day.plant.name}, ${ENGLISH_DAYS[index - 1]!}`;
    const guest = !day.guest ? `The library has no engraving of the ${english} yet.`
      : day.kind === "animal" ? `The ${english} visits it, cut from an engraving of the period.`
      : `The ${english} lies at its foot, cut from an engraving of the period.`;
    about = `The calendar gives this day to ${day.name}, ${english}, so the garden grows the day before's plant, ${plant}. ${guest}`;
  }
  return { title: capital(day.name), gloss: english, dateline: day.dateline, about, form: day.plant.form, variant: day.plant.variant, guest: day.guest, festival: null };
}

/** The garden the settings grow on the page; a hanging garden leaves the day's animal or tool out, as it would hang upside down. */
export function createGarden(state: PlaygroundState, geometry: Geometry): GardenPreview {
  const value = normalize(state, defaultState());
  const selection = resolveSelection(value);
  const garden = growGarden({
    seed: value.seed, form: selection.form, variant: selection.variant, width: geometry.column, height: geometry.height,
    ...(selection.guest && value.mode !== "hanging" ? { guest: selection.guest } : {}),
    ...(selection.festival ? { festival: selection.festival } : {}),
    ...(value.mode === "page" ? { page: { side: value.side, text: geometry.text, below: geometry.below } } : {}),
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

/** The garden on the page as a standalone SVG: its inks written in, its guest's engraving embedded and credited. */
export async function exportSvg(state: PlaygroundState, geometry: Geometry): Promise<string> {
  const value = normalize(state, defaultState());
  const { selection, garden } = createGarden(value, geometry);
  const guest = garden.guest && selection.guest ? selection.guest : null;
  const guestFigure = guest ? await figureDataUri(guest) : null;
  const id = `eglantine-${value.seed}`;
  const inks = paletteInks(value.palette, value.reading);
  const svg = withInks(renderGarden(garden, { t: value.t, fullness: value.fullness }, {
    manner: value.manner, id, scale: SAVED_SCALE, hanging: value.mode === "hanging", ...(guestFigure ? { guestFigure } : {}),
  }), inks);
  const attribution = guest ? guestCredit(guest) : "";
  const description = [selection.gloss, selection.dateline, selection.about, attribution].filter(Boolean).join(" ");
  const metadata = JSON.stringify({ generator: "Églantine", state: value, geometry, attribution });
  return svg.replace(/>/u, () => ` aria-labelledby="${id}-title ${id}-description">`
    + `<title id="${id}-title">${escapeXml(selection.title)}</title>`
    + `<desc id="${id}-description">${escapeXml(description)}</desc>`
    + `<metadata>${escapeXml(metadata)}</metadata>`
    + `<rect width="${num(garden.width)}" height="${num(garden.height)}" fill="${inks.paper}"/>`);
}

/** Browser code that grows and draws the garden the settings show, on another website. */
export function usageCode(state: PlaygroundState, geometry: Geometry): string {
  const value = normalize(state, defaultState());
  const selection = resolveSelection(value);
  const quote = JSON.stringify;
  const festival = selection.festival !== null;
  const guest = selection.guest !== null && value.mode !== "hanging";
  const size = `width: ${geometry.column}, height: ${geometry.height}`;
  const page = value.mode === "page"
    ? `,\n  // The text beside the column and the room under its last line, in centimetres at 32 pixels each.\n  page: { side: ${quote(value.side)}, text: ${geometry.text}, below: ${geometry.below} },`
    : ",";
  const lines = ['import { growGarden, renderGarden, paletteInks, withInks } from "eglantine-marginalia";'];
  if (value.source === "calendar") lines.push(
    `import { calendarDay${guest ? ", figureURL" : ""} } from "eglantine-marginalia/calendar";`,
    "", `const day = calendarDay(${quote(value.date)});`,
    "const garden = growGarden({",
    `  seed: ${value.seed}, form: day.plant.form, variant: day.plant.variant, ${size}${page}`,
    ...(guest ? ["  ...(day.guest ? { guest: day.guest } : {}),"] : []),
    ...(festival ? ["  // A complementary day's festival does something to the year's last plant.", "  ...(day.festival ? { festival: day.festival } : {}),"] : []),
    "});",
  );
  else lines.push("", "const garden = growGarden({",
    `  seed: ${value.seed}, form: ${quote(selection.form)},`,
    `  variant: ${quote(selection.variant)},`,
    `  ${size}${page}`, "});");
  lines.push(
    `const inks = paletteInks(${quote(value.palette)}, ${quote(value.reading)});`,
    `const svg = withInks(renderGarden(garden, { t: ${value.t}, fullness: ${value.fullness} }, {`,
    `  manner: ${quote(value.manner)}, id: "margin", scale: 32,${value.mode === "hanging" ? " hanging: true," : ""}`,
    ...(guest ? ["  ...(day.guest ? { guestFigure: figureURL(day.guest.figure).href } : {}),"] : []),
    "}), inks);", "",
  );
  if (value.mode === "page") lines.push(
    "// The drawing covers the column and the text beside it: lay it under the text, at the foot of the page.",
    'const layer = document.createElement("div");',
    'Object.assign(layer.style, { position: "absolute", left: "0", bottom: "0", zIndex: "-1", pointerEvents: "none" });',
    "layer.innerHTML = svg;",
    'document.querySelector("article").append(layer);',
  );
  else lines.push(
    'const margin = document.createElement("aside");',
    `Object.assign(margin.style, { float: ${quote(value.side)}, background: inks.paper });`,
    "margin.innerHTML = svg;", "document.body.prepend(margin);",
  );
  if (guest && selection.guest) lines.push("", "// Inline SVG can use the figure URL; a downloaded SVG needs a PNG data URI.",
    `// Figure attribution: ${guestCredit(selection.guest)}`);
  return lines.join("\n");
}
