import { figureURL, republicanDate } from "../src/calendar/index.js";
import { growGarden } from "../src/grow.js";
import { INK_PROPERTIES, withInks } from "../src/inks.js";
import { PALETTES, paletteInks } from "../src/palettes.js";
import { renderGarden } from "../src/render.js";
import { PLANTS, PALETTE_LABELS, type PlantChoice } from "./catalog.js";
import { createGarden, defaultState, exportSvg, readState, stateHash, usageCode, type GardenPreview, type PlaygroundState } from "./garden-state.js";

function element<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing playground element: ${id}`);
  return found as T;
}

const page = element("page");
const gardenElement = element("garden");
const status = element("action-status");
const dateInput = element<HTMLInputElement>("calendar-date");
const dateError = element("date-error");
const download = element<HTMLButtonElement>("download");
const codeDetails = element<HTMLDetailsElement>("code-details");
const morePlants = element<HTMLDetailsElement>("more-plants");
const copyFallback = element("copy-fallback");
const copyValue = element<HTMLTextAreaElement>("copy-value");
const timeInput = element<HTMLInputElement>("time");
const fullnessInput = element<HTMLInputElement>("fullness");
const marginInput = element<HTMLInputElement>("margin");
const plantButtons = new Map<string, HTMLButtonElement>();
const paletteButtons = new Map<string, HTMLButtonElement>();
const thumbnailDrawings = new Map<string, string>();
const thumbnailImages = new Map<string, HTMLImageElement>();
let state = readState(location.hash);
let grown: GardenPreview | null = null;
let grownKey = "";
let drawnKey = "";
let thumbnailReading = "";
let pendingFrame = 0;
let exporting = false;
let othersLoaded = false;

element<HTMLAnchorElement>("font-license").href = new URL("./fonts/OFL.txt", import.meta.url).href;

function announce(message: string, error = false): void {
  status.textContent = message;
  status.dataset.error = String(error);
}

function thumbnail(plant: PlantChoice): string {
  let svg = thumbnailDrawings.get(plant.id);
  if (!svg) {
    const garden = growGarden({ seed: 1793, form: plant.form, variant: plant.variant });
    svg = renderGarden(garden, { t: 0.7, fullness: 0.7 }, { manner: "taille-douce", id: `thumb-${plant.id}`, scale: 10 });
    svg = svg.replace('viewBox="0 0 6 22"', 'viewBox="0 3 6 19"');
    thumbnailDrawings.set(plant.id, svg);
  }
  const ink = state.reading === "light" ? "#304d37" : "#dae2ca";
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withInks(svg, { ink, wash: ink, accent: ink, paper: "transparent" }))}`;
}

function plantButton(plant: PlantChoice): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "plant-choice";
  button.dataset.plant = plant.id;
  button.setAttribute("aria-pressed", String(state.source === "plants" && state.plant === plant.id));
  const drawing = document.createElement("span");
  drawing.className = "plant-drawing";
  const image = new Image();
  image.alt = "";
  image.width = 62;
  image.height = 75;
  image.decoding = "async";
  image.src = thumbnail(plant);
  drawing.append(image);
  const name = document.createElement("span");
  name.className = "plant-name";
  name.textContent = plant.name;
  button.append(drawing, name);
  button.addEventListener("click", () => update({ source: "plants", plant: plant.id }, true));
  plantButtons.set(plant.id, button);
  thumbnailImages.set(plant.id, image);
  return button;
}

function loadMorePlants(): void {
  if (othersLoaded) return;
  othersLoaded = true;
  element("other-plants").append(...PLANTS.slice(6).map(plantButton));
}

function makePaletteButtons(): void {
  for (const palette of PALETTES) {
    const label = PALETTE_LABELS[palette.id]!;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "palette-choice";
    button.dataset.palette = palette.id;
    button.setAttribute("aria-label", label.name);
    button.title = `${label.name}: ${label.description}`;
    const sample = document.createElement("span");
    sample.className = "palette-sample";
    sample.setAttribute("aria-hidden", "true");
    sample.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
    const name = document.createElement("span");
    name.className = "palette-name";
    name.textContent = label.name;
    button.append(sample, name);
    button.addEventListener("click", () => update({ palette: palette.id }, true));
    paletteButtons.set(palette.id, button);
    element("palettes").append(button);
  }
}

function syncControls(): void {
  for (const input of document.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
    const key = input.name as "source" | "manner" | "reading" | "side";
    input.checked = state[key] === input.value;
  }
  dateInput.value = state.date;
  timeInput.value = String(state.t);
  fullnessInput.value = String(state.fullness);
  marginInput.value = String(state.margin);
  element("time-value").textContent = state.t < 0.25 ? "Early morning" : state.t < 0.5 ? "Late morning" : state.t < 0.8 ? "Afternoon" : "Evening";
  element("fullness-value").textContent = `${Math.round(state.fullness * 100)}%`;
  element("margin-value").textContent = `${state.margin}%`;
  element("plant-panel").hidden = state.source !== "plants";
  element("calendar-panel").hidden = state.source !== "calendar";
  for (const [id, button] of plantButtons) button.setAttribute("aria-pressed", String(state.source === "plants" && state.plant === id));
  if (state.source === "plants" && PLANTS.findIndex(plant => plant.id === state.plant) >= 6) {
    loadMorePlants();
    morePlants.open = true;
  }
  for (const palette of PALETTES) {
    const button = paletteButtons.get(palette.id)!;
    button.setAttribute("aria-pressed", String(state.palette === palette.id));
    for (const [key, value] of Object.entries(palette[state.reading])) button.style.setProperty(`--swatch-${key}`, value);
  }
  const chosenPalette = PALETTES.find(palette => palette.id === state.palette)!;
  element("palette-story").textContent = `${chosenPalette.name}. ${PALETTE_LABELS[state.palette]!.description}`;
  if (thumbnailReading !== state.reading) {
    thumbnailReading = state.reading;
    for (const plant of PLANTS) {
      const image = thumbnailImages.get(plant.id);
      if (image) image.src = thumbnail(plant);
    }
  }
}

function render(): void {
  const key = JSON.stringify([state.source, state.plant, state.date, state.seed]);
  if (!grown || grownKey !== key) {
    grown = createGarden(state);
    grownKey = key;
  }
  const { selection, garden } = grown;
  document.documentElement.dataset.reading = state.reading;
  const inks = paletteInks(state.palette, state.reading);
  for (const name of Object.keys(INK_PROPERTIES) as (keyof typeof INK_PROPERTIES)[]) page.style.setProperty(INK_PROPERTIES[name], inks[name]);
  page.style.setProperty("--margin-room", `${state.margin}%`);
  page.dataset.side = state.side;
  element("preview-name").textContent = selection.name;
  element("preview-manner").textContent = state.manner === "lavis" ? "Ink wash" : "Engraving";
  element("page-plant").textContent = selection.subtitle;
  element("plant-description").textContent = selection.description;
  element("calendar-dateline").textContent = selection.dateline;
  document.title = `${selection.name} — Églantine`;
  const drawKey = JSON.stringify([key, state.manner, state.t, state.fullness]);
  if (drawnKey !== drawKey) {
    if (garden) {
      const svg = renderGarden(garden, { t: state.t, fullness: state.fullness }, {
        manner: state.manner, id: `playground-${state.seed}`, scale: 32,
        ...(selection.guest ? { guestFigure: figureURL(selection.guest.figure).href } : {}),
      });
      gardenElement.innerHTML = svg;
      gardenElement.querySelector("svg")!.setAttribute("aria-label", `${selection.name}, ${state.manner === "lavis" ? "ink wash" : "engraving"}`);
    } else gardenElement.replaceChildren();
    drawnKey = drawKey;
  }
  gardenElement.setAttribute("aria-busy", "false");
  const empty = element("empty-garden");
  empty.hidden = garden !== null;
  empty.textContent = "A complementary day. A little space, with no plant.";
  download.disabled = !garden || exporting || !dateError.hidden;
  element<HTMLButtonElement>("new-seed").disabled = !garden;
  syncControls();
  if (codeDetails.open) element("usage-code").textContent = usageCode(state);
}

function safeRender(): void {
  try { render(); } catch (error) {
    gardenElement.setAttribute("aria-busy", "false");
    download.disabled = true;
    announce(`The garden could not be drawn. ${error instanceof Error ? error.message : String(error)}`, true);
    console.error(error);
  }
}

function update(patch: Partial<PlaygroundState>, remember = false): void {
  const next = { ...state, ...patch };
  const hash = stateHash(next);
  if (hash === stateHash(state)) return;
  state = next;
  dateError.hidden = true;
  dateInput.removeAttribute("aria-invalid");
  copyFallback.hidden = true;
  announce("");
  if (remember) history.pushState(null, "", hash);
  else history.replaceState(null, "", hash);
  cancelAnimationFrame(pendingFrame);
  pendingFrame = requestAnimationFrame(safeRender);
}

async function copy(text: string, success: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    copyFallback.hidden = true;
    announce(success);
  } catch {
    copyValue.value = text;
    copyFallback.hidden = false;
    copyValue.focus();
    copyValue.select();
    announce("Clipboard access is unavailable. Select and copy the text below.");
  }
}

document.querySelector<HTMLAnchorElement>(".skip-link")!.addEventListener("click", event => {
  event.preventDefault();
  const controls = element("controls");
  controls.focus({ preventScroll: true });
  controls.scrollIntoView({ block: "start" });
});

for (const input of document.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
  input.addEventListener("change", () => {
    if (input.checked) update({ [input.name]: input.value }, true);
  });
}
timeInput.addEventListener("input", () => update({ t: timeInput.valueAsNumber }));
fullnessInput.addEventListener("input", () => update({ fullness: fullnessInput.valueAsNumber }));
marginInput.addEventListener("input", () => update({ margin: marginInput.valueAsNumber }));
dateInput.addEventListener("change", () => {
  try {
    republicanDate(dateInput.value);
    dateError.hidden = true;
    dateInput.removeAttribute("aria-invalid");
    update({ date: dateInput.value }, true);
    if (grown?.garden && !exporting) download.disabled = false;
  } catch {
    dateError.hidden = false;
    dateInput.setAttribute("aria-invalid", "true");
    download.disabled = true;
  }
});
element("today").addEventListener("click", () => {
  dateInput.value = defaultState().date;
  dateInput.dispatchEvent(new Event("change"));
});
element("new-seed").addEventListener("click", () => update({ seed: crypto.getRandomValues(new Uint32Array(1))[0]! }, true));
morePlants.addEventListener("toggle", () => { if (morePlants.open) loadMorePlants(); });
codeDetails.addEventListener("toggle", () => { if (codeDetails.open) element("usage-code").textContent = usageCode(state); });
element("share").addEventListener("click", () => {
  const url = new URL(location.href);
  url.hash = stateHash(state);
  void copy(url.href, "Garden link copied.");
});
element("copy-code").addEventListener("click", () => { void copy(usageCode(state), "Garden code copied."); });
element("close-copy").addEventListener("click", () => { copyFallback.hidden = true; element("share").focus(); });
download.addEventListener("click", async () => {
  if (exporting) return;
  exporting = true;
  download.disabled = true;
  const snapshot = { ...state };
  announce("Preparing the SVG…");
  try {
    const svg = await exportSvg(snapshot);
    const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `eglantine-${snapshot.source === "plants" ? snapshot.plant : snapshot.date}.svg`;
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    announce("SVG saved with its inks and any guest engraving included.");
  } catch (error) {
    announce(`The SVG could not be saved. ${error instanceof Error ? error.message : String(error)} Try again.`, true);
  } finally {
    exporting = false;
    download.disabled = !grown?.garden || !dateError.hidden;
  }
});

function restoreLocation(): void {
  state = readState(location.hash);
  dateError.hidden = true;
  dateInput.removeAttribute("aria-invalid");
  copyFallback.hidden = true;
  announce("");
  cancelAnimationFrame(pendingFrame);
  safeRender();
}
window.addEventListener("popstate", restoreLocation);
window.addEventListener("hashchange", restoreLocation);
makePaletteButtons();
element("featured-plants").append(...PLANTS.slice(0, 6).map(plantButton));
element("plant-count").textContent = `(${PLANTS.length - 6})`;
safeRender();
