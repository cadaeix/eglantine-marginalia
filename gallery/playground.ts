// The playground: a page with Églantine growing in its own margin. The text column holds the day's plant
// and the garden's settings; the garden is grown for the page as it is laid out, and grown again when the
// page changes shape, so with "round the text" it fills whatever room the text leaves below it.
import { figureURL } from "../src/calendar/index.js";
import { clamp } from "../src/geometry.js";
import { INK_PROPERTIES } from "../src/inks.js";
import { PALETTES, paletteInks } from "../src/palettes.js";
import { createRng } from "../src/random.js";
import { plantForm } from "../src/registry.js";
import { renderGarden } from "../src/render.js";
import { PLANTS } from "./catalog.js";
import { shapesSvg } from "./drawing.js";
import {
  createGarden, defaultState, exportSvg, type GardenPreview, type Geometry, type Mode,
  type PlaygroundState, randomDay, readState, resolveSelection, stateHash, today, usageCode,
} from "./garden-state.js";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing playground element: ${id}`);
  return found as T;
}

const sheet = element("sheet");
const text = element("text");
const entry = element("entry");
const body = element("body");
const gardenElement = element("garden");
const status = element("status");
const dateInput = element<HTMLInputElement>("date");
const timeInput = element<HTMLInputElement>("time");
const timeControls = timeInput.parentElement!;
const fullnessInput = element<HTMLInputElement>("fullness");
const playButton = element<HTMLButtonElement>("play");
const download = element<HTMLButtonElement>("download");
const plantDialog = element<HTMLDialogElement>("plant-dialog");
const codeDialog = element<HTMLDialogElement>("code-dialog");
const copyDialog = element<HTMLDialogElement>("copy-dialog");
const compact = matchMedia("(max-width: 720px), (max-width: 1100px) and (pointer: coarse)");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

const MODE_NOTES: Readonly<Record<Mode, string>> = {
  margin: "The plant keeps to its column, as it would in a sidebar.",
  page: "The plant reaches round the text, into the room under its last line.",
  hanging: "The plant hangs from the top of the margin, without its animal or tool.",
};
/** The garden's tallest column, in centimetres: a long page keeps its garden at its foot. */
const TALLEST = 30;
/**
 * The room the page always leaves under the text's last line when the garden grows round the text, in
 * centimetres. The text is as long in a short window as in a tall one, so a page fitted to the window alone
 * would leave a short window no room at all; six centimetres holds the runner along the foot and the arcs
 * above it. A taller window still leaves more.
 */
const ROOM = 6;

/**
 * The visitor's hour as the garden's time of day: the day starts at six in the morning and ends at ten at
 * night, and the night keeps the evening's seed heads. Before mid-morning it shows mid-morning, so the plant
 * is always in leaf.
 */
function hourOfDay(): number {
  const now = new Date();
  const since = (now.getHours() + now.getMinutes() / 60 + 18) % 24;
  return Math.round(clamp(since / 16, 0.4, 1) * 100) / 100;
}

const firstVisit = location.hash.length <= 1;
const startingState = (): PlaygroundState => defaultState({
  reading: matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light", t: hourOfDay(),
});
let state = readState(location.hash, startingState());
let geometry: Geometry | null = null;
/** Pixels per centimetre of the garden, chosen so that the page holds a column about 25 cm tall. */
let cm = 32;
let grown: { key: string; preview: GardenPreview } | null = null;
let drawnKey = "";
let exporting = false;
let animation = 0;
let pendingFrame = 0;
let resizeTimer = 0;
const paletteInputs = new Map<string, HTMLInputElement>();

element<HTMLAnchorElement>("font-license").href = new URL("./fonts/OFL.txt", import.meta.url).href;

function announce(message: string, error = false): void {
  status.textContent = message;
  status.dataset.error = String(error);
}

// ---------------------------------------------------------------- the page's inks and text

function applyInks(): void {
  const inks = paletteInks(state.palette, state.reading);
  const root = document.documentElement;
  for (const name of Object.keys(INK_PROPERTIES) as (keyof typeof INK_PROPERTIES)[]) {
    root.style.setProperty(`--${name}`, inks[name]);
    root.style.setProperty(INK_PROPERTIES[name], inks[name]);
  }
  root.style.colorScheme = state.reading;
  document.querySelector('meta[name="theme-color"]')!.setAttribute("content", inks.paper);
  for (const palette of PALETTES) {
    const swatch = paletteInputs.get(palette.id)!.nextElementSibling as HTMLElement;
    for (const [key, value] of Object.entries(palette[state.reading])) swatch.style.setProperty(`--swatch-${key}`, value);
  }
}

function showText(): void {
  const selection = resolveSelection(state);
  element("dateline").textContent = selection.dateline;
  element("dateline").hidden = selection.dateline === "";
  const title = element("title");
  title.textContent = selection.title;
  title.lang = state.source === "calendar" ? "fr" : "en";
  const gloss = element("gloss");
  gloss.textContent = selection.gloss;
  gloss.lang = state.source === "calendar" ? "en" : "fr";
  element("about").textContent = selection.about;
  document.title = `${selection.title} · Églantine`;
}

function showTime(): void {
  timeInput.value = String(state.t);
  timeInput.setAttribute("aria-valuetext", state.t < 0.3 ? "morning" : state.t < 0.6 ? "midday" : state.t < 0.85 ? "afternoon" : "evening");
}

function syncPlayback(playing: boolean): void {
  playButton.setAttribute("aria-pressed", String(playing));
  playButton.textContent = playing ? "pause the day" : reducedMotion.matches ? "show the evening" : "watch the day";
}

function syncControls(): void {
  for (const input of document.querySelectorAll<HTMLInputElement>('.words input[type="radio"]')) {
    input.checked = state[input.name as "manner" | "reading" | "mode" | "side"] === input.value;
  }
  for (const [id, input] of paletteInputs) input.checked = state.palette === id;
  const palette = PALETTES.find(candidate => candidate.id === state.palette)!;
  const note = element("palette-note");
  note.textContent = `${palette.name}, ${palette.period}`;
  note.title = palette.note;
  element("mode-note").textContent = MODE_NOTES[state.mode];
  element("day-setting").hidden = state.source !== "calendar";
  element("plant-setting").hidden = state.source !== "plants";
  element("plant-name").textContent = PLANTS.find(plant => plant.id === state.plant)!.name;
  dateInput.value = state.date;
  showTime();
  fullnessInput.value = String(state.fullness);
  fullnessInput.setAttribute("aria-valuetext", `${Math.round(state.fullness * 100)}% full`);
  syncPlayback(animation !== 0);
  element("seed").textContent = String(state.seed);
  sheet.dataset.side = state.side;
  sheet.dataset.mode = state.mode;
}

// ---------------------------------------------------------------- measuring the page and growing its garden

const half = (value: number): number => Math.round(value * 2) / 2;

/** Lays the page out for the window, then measures it, in the garden's centimetres. */
function measure(): void {
  const onCompact = compact.matches;
  const home = onCompact ? element("phone-slot") : text;
  if (body.parentElement !== home) home.append(body);
  const playbackHome = onCompact ? entry : timeControls;
  if (playButton.parentElement !== playbackHome) playbackHome.append(playButton);
  const top = onCompact ? 0 : element("masthead").offsetHeight;
  const sheetHeight = onCompact ? sheet.getBoundingClientRect().height : Math.max(480, innerHeight - top);
  cm = onCompact ? sheetHeight / 22 : clamp(Math.round(sheetHeight / 25), 22, 36);
  sheet.style.setProperty("--cm", `${cm}px`);
  // The text's last line, from the top of the page. The centimetre comes from the window alone, so lengthening
  // the page to leave room under the text never rewraps the text or moves its last line.
  const end = Math.max(...[...text.children].map(child => child.getBoundingClientRect().bottom)) - sheet.getBoundingClientRect().top;
  const room = onCompact || state.mode !== "page" ? 0 : end + ROOM * cm;
  sheet.style.setProperty("--sheet-height", `${Math.max(sheetHeight, room)}px`);
  const page = sheet.getBoundingClientRect(), column = text.getBoundingClientRect();
  const height = half(Math.min(page.height / cm, TALLEST));
  geometry = {
    column: 6,
    height,
    text: half((column.width + cm) / cm),
    below: clamp(half((page.height - end) / cm), 0, height),
  };
}

/** Places the drawing on the page: under the text and its margin, in the margin, or hanging from its top. */
function place(svgWidth: number, svgHeight: number): void {
  const page = sheet.getBoundingClientRect(), column = text.getBoundingClientRect();
  const columnPx = 6 * cm;
  const marginLeft = state.side === "right" ? column.right - page.left + cm : column.left - page.left - cm - columnPx;
  const left = state.mode === "page" && state.side === "right" ? marginLeft + columnPx - svgWidth : marginLeft;
  Object.assign(gardenElement.style, {
    left: `${left}px`, width: `${svgWidth}px`, height: `${svgHeight}px`,
    top: state.mode === "hanging" ? "0" : "auto", bottom: state.mode === "hanging" ? "auto" : "0",
  });
}

function drawGarden(): void {
  if (!geometry) return;
  const key = JSON.stringify([state.source, state.plant, state.date, state.seed, state.mode, state.side, geometry]);
  if (!grown || grown.key !== key) grown = { key, preview: createGarden(state, geometry) };
  const { selection, garden } = grown.preview;
  download.disabled = exporting;
  const drawKey = JSON.stringify([key, state.manner, state.t, state.fullness, cm]);
  if (drawKey !== drawnKey) {
    const guestFigure = garden.guest && selection.guest ? { guestFigure: figureURL(selection.guest.figure).href } : {};
    gardenElement.innerHTML = renderGarden(garden, { t: state.t, fullness: state.fullness }, { manner: state.manner, id: "garden", scale: cm, hanging: state.mode === "hanging", ...guestFigure });
    gardenElement.querySelector("svg")!.setAttribute("aria-label", `${selection.title}, ${state.manner === "lavis" ? "in wash" : "engraved"}, in the page's margin`);
    drawnKey = drawKey;
  }
  // A hanging garden's drawing is shorter than the garden by the root it crops away; the SVG gives its size.
  const drawing = gardenElement.querySelector("svg")!;
  place(Number(drawing.getAttribute("width")), Number(drawing.getAttribute("height")));
}

/** Everything the settings show: the inks, the text, the controls, then the page measured and its garden. */
function refresh(): void {
  try {
    applyInks();
    showText();
    syncControls();
    measure();
    drawGarden();
  } catch (error) {
    announce(`The garden could not be drawn. ${error instanceof Error ? error.message : String(error)}`, true);
    console.error(error);
  }
}

function schedule(): void {
  cancelAnimationFrame(pendingFrame);
  pendingFrame = requestAnimationFrame(refresh);
}

function update(patch: Partial<PlaygroundState>, remember = false): void {
  const next = { ...state, ...patch };
  const hash = stateHash(next);
  if (hash === stateHash(state)) return;
  state = next;
  announce("");
  if (remember) history.pushState(null, "", hash);
  else history.replaceState(null, "", hash);
  schedule();
}

// ---------------------------------------------------------------- the day passing

function stopDay(): void {
  cancelAnimationFrame(animation);
  animation = 0;
  syncPlayback(false);
}

/** Runs the time of day from `from` to `to` over `duration` milliseconds, drawing as it goes, and keeps the end in the URL if `record`. */
function passDay(from: number, to: number, duration: number, record = true): void {
  stopDay();
  syncPlayback(true);
  const start = performance.now();
  const step = (now: number): void => {
    const u = Math.min(1, (now - start) / duration);
    state = { ...state, t: Math.round((from + (to - from) * u) * 1000) / 1000 };
    showTime();
    drawGarden();
    if (u < 1) animation = requestAnimationFrame(step);
    else {
      stopDay();
      if (record) history.replaceState(null, "", stateHash(state));
    }
  };
  animation = requestAnimationFrame(step);
}

// ---------------------------------------------------------------- the plant chooser, copying and saving

function buildPlants(): void {
  const list = element("plants");
  if (list.childElementCount > 0) return;
  for (const plant of PLANTS) {
    const form = plantForm(plant.form, plant.variant);
    const shapes = plant.part === "foot" && form.foot ? form.foot.draw(createRng(3), { width: 6, height: 22 }, 1, 1)
      : plant.part === "leaf" ? form.leaf(createRng(11), 2.2, 0.1)
      : form.terminal.draw(createRng(7), 1.4, "bloom");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "plant";
    button.dataset.plant = plant.id;
    button.innerHTML = shapesSvg(shapes, "taille-douce", `plant-${plant.id}`, 40);
    button.querySelector("svg")?.setAttribute("aria-hidden", "true");
    const name = document.createElement("span");
    name.textContent = plant.name;
    const french = document.createElement("span");
    french.className = "french";
    french.lang = "fr";
    french.textContent = plant.french;
    button.append(name, french);
    button.addEventListener("click", () => {
      plantDialog.close();
      update({ source: "plants", plant: plant.id }, true);
    });
    list.append(button);
  }
}

function openPlants(): void {
  buildPlants();
  for (const button of element("plants").querySelectorAll<HTMLButtonElement>(".plant")) {
    button.setAttribute("aria-pressed", String(state.source === "plants" && state.plant === button.dataset.plant));
  }
  plantDialog.showModal();
}

async function copy(value: string, success: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(value);
    announce(success);
  } catch {
    const field = element<HTMLTextAreaElement>("copy-value");
    field.value = value;
    copyDialog.showModal();
    field.focus();
    field.select();
  }
}

function shiftDay(days: number): void {
  const [year, month, day] = state.date.split("-").map(Number) as [number, number, number];
  const next = new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
  if (next >= dateInput.min) update({ source: "calendar", date: next }, true);
}

function makePalettes(): void {
  const list = element("palettes");
  for (const palette of PALETTES) {
    const label = document.createElement("label");
    label.title = `${palette.name}, ${palette.period}`;
    const input = document.createElement("input");
    input.type = "radio";
    input.name = "palette";
    input.value = palette.id;
    input.setAttribute("aria-label", palette.name);
    input.addEventListener("change", () => { if (input.checked) update({ palette: palette.id }, true); });
    const swatch = document.createElement("span");
    swatch.className = "swatch";
    label.append(input, swatch);
    list.append(label);
    paletteInputs.set(palette.id, input);
  }
}

// ---------------------------------------------------------------- wiring

document.querySelector<HTMLAnchorElement>(".skip-link")!.addEventListener("click", event => {
  event.preventDefault();
  element("settings").focus({ preventScroll: true });
  element("settings").scrollIntoView({ block: "start" });
});
for (const input of document.querySelectorAll<HTMLInputElement>('.words input[type="radio"]')) {
  input.addEventListener("change", () => { if (input.checked) update({ [input.name]: input.value }, true); });
}
timeInput.addEventListener("input", () => { stopDay(); update({ t: timeInput.valueAsNumber }); });
fullnessInput.addEventListener("input", () => update({ fullness: fullnessInput.valueAsNumber }));
dateInput.addEventListener("change", () => {
  if (dateInput.validity.valid && dateInput.value) update({ source: "calendar", date: dateInput.value }, true);
  else announce("Choose a date on or after 22 September 1792.", true);
});
element("day-before").addEventListener("click", () => shiftDay(-1));
element("day-after").addEventListener("click", () => shiftDay(1));
element("today").addEventListener("click", () => update({ source: "calendar", date: today() }, true));
element("calendar-plant").addEventListener("click", () => update({ source: "calendar", date: today() }, true));
element("choose-plant").addEventListener("click", openPlants);
element("another-plant").addEventListener("click", openPlants);
for (const button of document.querySelectorAll<HTMLButtonElement>(".random-plant")) {
  button.addEventListener("click", () => update({ source: "calendar", date: randomDay("plant", today(), Math.random, state.date) }, true));
}
for (const button of document.querySelectorAll<HTMLButtonElement>(".random-visitor")) {
  button.addEventListener("click", () => {
    const hanging = state.mode === "hanging";
    update({ source: "calendar", date: randomDay("visitor", today(), Math.random, state.date), mode: hanging ? "page" : state.mode }, true);
    if (hanging) announce("A hanging garden leaves its visitor out, so this one grows round the text.");
  });
}
element("new-seed").addEventListener("click", () => update({ seed: crypto.getRandomValues(new Uint32Array(1))[0]! }, true));
playButton.addEventListener("click", () => {
  if (animation) stopDay();
  else passDay(0, 1, reducedMotion.matches ? 1 : 9000);
});
element("share").addEventListener("click", () => {
  const url = new URL(location.href);
  url.hash = stateHash(state);
  void copy(url.href, "A link to this garden is copied.");
});
element("show-code").addEventListener("click", () => {
  if (!geometry) return;
  element("usage-code").textContent = usageCode(state, geometry);
  codeDialog.showModal();
});
element("copy-code").addEventListener("click", () => {
  if (geometry) void copy(usageCode(state, geometry), "The code is copied.");
});
download.addEventListener("click", async () => {
  if (exporting || !geometry) return;
  exporting = true;
  download.disabled = true;
  const snapshot = { ...state }, measured = { ...geometry };
  announce("Drawing the SVG…");
  try {
    const svg = await exportSvg(snapshot, measured);
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `eglantine-${snapshot.source === "plants" ? snapshot.plant : snapshot.date}.svg`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    announce("The SVG is saved, with its inks and any engraving in it.");
  } catch (error) {
    announce(`The SVG could not be saved. ${error instanceof Error ? error.message : String(error)}`, true);
  } finally {
    exporting = false;
    drawGarden();
  }
});

function restoreLocation(): void {
  stopDay();
  state = readState(location.hash, startingState());
  announce("");
  schedule();
}
window.addEventListener("popstate", restoreLocation);
window.addEventListener("hashchange", restoreLocation);
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(schedule, 120);
});
compact.addEventListener("change", schedule);
reducedMotion.addEventListener("change", () => {
  stopDay();
  schedule();
});

makePalettes();
// A first visit opens on the plant growing from the morning to the hour of the visit, and keeps the URL bare.
const opening = firstVisit && !reducedMotion.matches ? state.t : null;
if (opening !== null) state = { ...state, t: 0.05 };
refresh();
// The fonts change the text's length, and so the room under it.
void document.fonts.ready.then(() => {
  refresh();
  if (opening !== null && grown?.preview.garden) passDay(0.05, opening, 2600, false);
  else if (opening !== null) state = { ...state, t: opening };
});
