// The gallery: every plant form's examples as gardens at bloom and at seed, with their bloom at bud,
// bloom and seed and their leaf drawn large, so a form's author can judge it by eye; and today's garden
// from the calendar through the day. `#form=<id>` opens one form, `#all` shows every example small,
// `#today` shows the calendar's day (`&date=YYYY-MM-DD` another day's); `&manner=lavis` and `&paper=night` change the plate.
// When the dev server is given a palette sheet (see vite.config.ts), `&palette=<reading>` draws everything in one of its palettes.
import { calendarDay, figureURL, localDate } from "../src/calendar/index.js";
import type { FormModule, Variant } from "../src/form.js";
import { num, type Pt } from "../src/geometry.js";
import { growGarden } from "../src/grow.js";
import { type Manner, paintShapes, Sheet } from "../src/paint.js";
import { createRng, seedFromText } from "../src/random.js";
import { FORM_MODULES, plantForm } from "../src/registry.js";
import { renderGarden } from "../src/render.js";
import type { Shape } from "../src/shapes.js";

interface Route { form: string | null; all: boolean; today: boolean; date: string | null; manner: Manner; paper: "cream" | "night"; palette: string | null }

function readRoute(): Route {
  const params = new URLSearchParams(location.hash.slice(1));
  return {
    form: params.get("form"), all: params.has("all"), today: params.has("today"), date: params.get("date"),
    manner: params.get("manner") === "lavis" ? "lavis" : "taille-douce", paper: params.get("paper") === "night" ? "night" : "cream",
    palette: params.get("palette"),
  };
}

/**
 * The readings of the palette sheets the dev server was given, such as `cordelier-chandelle`, with the sheets
 * added to the page; none without a sheet. The sheets themselves set the garden's four inks for each reading.
 */
async function loadPalettes(): Promise<string[]> {
  const response = await fetch("/palettes.css");
  if (!response.ok) return [];
  const sheet = await response.text();
  const style = document.createElement("style");
  style.textContent = sheet;
  document.head.prepend(style);
  return [...new Set([...sheet.matchAll(/\[data-nuancier="([a-z-]+-(?:jour|chandelle))"\]/gu)].map(match => match[1]!))];
}

const PALETTES = await loadPalettes();

const escape = (text: string): string => text.replace(/[&<>"]/gu, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c]!);

function points(shape: Shape): Pt[] {
  switch (shape.type) {
    case "body": return shape.outline;
    case "solid": return shape.outline;
    case "line": return shape.points;
    case "dots": return shape.points;
  }
}

/** Shapes drawn alone, framed to their own bounds, at `scale` pixels per centimetre. */
function shapesSvg(shapes: Shape[], manner: Manner, id: string, scale: number): string {
  const all = shapes.flatMap(points);
  if (all.length === 0) return "";
  const pad = 0.1;
  const x0 = Math.min(...all.map(p => p[0])) - pad, x1 = Math.max(...all.map(p => p[0])) + pad;
  const y0 = Math.min(...all.map(p => p[1])) - pad, y1 = Math.max(...all.map(p => p[1])) + pad;
  const sheet = new Sheet(id);
  const body = paintShapes(shapes, manner, sheet);
  return `<svg xmlns="http://www.w3.org/2000/svg" class="eglantine" viewBox="${num(x0)} ${num(-y1)} ${num(x1 - x0)} ${num(y1 - y0)}" width="${num((x1 - x0) * scale)}" height="${num((y1 - y0) * scale)}">`
    + `<defs>${sheet.defs.join("")}</defs><g transform="scale(1 -1)">${body}</g></svg>`;
}

const garden = (module: FormModule, variant: Variant, t: number, manner: Manner, id: string, scale: number): string =>
  renderGarden(growGarden({ seed: 20261031, form: module.id, variant }), { t, fullness: 0.75 }, { manner, id, scale });

const figure = (svg: string, caption: string): string => `<figure>${svg}<figcaption>${caption}</figcaption></figure>`;
const slug = (text: string): string => text.normalize("NFD").replace(/[^a-z0-9-]/giu, "");

function example(module: FormModule, name: string, variant: Variant, manner: Manner): string {
  const form = plantForm(module.id, variant);
  const id = slug(`${module.id}-${name}`);
  const blooms = (["bud", "bloom", "seed"] as const).map(stage => figure(shapesSvg(form.terminal.draw(createRng(7), 1.4, stage), manner, `${id}-${stage}`, 110), stage));
  return `<section><h2>${escape(name)} <code>${escape(JSON.stringify(variant))}</code></h2><div class="row">`
    + figure(garden(module, variant, 0.62, manner, `${id}-g1`, 24), "bloom (t 0.62)")
    + figure(garden(module, variant, 0.97, manner, `${id}-g2`, 24), "seed (t 0.97)")
    + blooms.join("")
    + figure(shapesSvg(form.leaf(createRng(11), 2.2, 0.1), manner, `${id}-leaf`, 90), "leaf")
    + "</div></section>";
}

function today(manner: Manner, asked: string | null): string {
  const date = asked ?? localDate(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone);
  const day = calendarDay(date);
  if (!day.plant) return `<h1>${escape(day.dateline)}</h1><p>A complementary day: no plant grows.</p>`;
  const grown = growGarden({ seed: seedFromText(date), form: day.plant.form, variant: day.plant.variant, ...(day.guest ? { guest: day.guest } : {}) });
  const guestFigure = day.guest ? figureURL(day.guest.figure).href : undefined;
  const moments = [[0.1, 0.1], [0.4, 0.4], [0.7, 0.7], [0.97, 1]] as const;
  return `<h1>${escape(day.dateline)}: ${escape(day.name)}</h1><p>${escape(day.plant.name)}, drawn by <code>${day.plant.form}</code>${day.guest ? `, with ${escape(day.guest.name)}` : ""}.</p><div class="row">`
    + moments.map(([t, fullness], k) => figure(renderGarden(grown, { t, fullness }, { manner, id: `today-${k}`, scale: 24, ...(guestFigure ? { guestFigure } : {}) }), `t ${t}, fullness ${fullness}`)).join("")
    + "</div>";
}

function draw(): void {
  const route = readRoute();
  const palette = route.palette !== null && PALETTES.includes(route.palette) ? route.palette : null;
  const root = document.documentElement;
  if (palette) { root.dataset.nuancier = palette; delete root.dataset.paper; } else { delete root.dataset.nuancier; root.dataset.paper = route.paper; }
  const modules = [...FORM_MODULES.values()].sort((a, b) => a.id.localeCompare(b.id));
  const selected = route.form ? FORM_MODULES.get(route.form) : undefined;
  const link = (place: Record<string, string>, change: Partial<Route> = {}): string => {
    const next = { ...route, ...change };
    return `#${new URLSearchParams({ ...place, manner: next.manner, paper: next.paper, ...(next.palette ? { palette: next.palette } : {}) })}`;
  };
  const here: Record<string, string> = route.form ? { form: route.form } : route.all ? { all: "" } : route.today ? { today: "", ...(route.date ? { date: route.date } : {}) } : {};
  const chooser = PALETTES.length === 0 ? "" : `<select id="palette" aria-label="Palette"><option value="">no palette</option>`
    + PALETTES.map(id => `<option value="${id}"${id === palette ? " selected" : ""}>${id}</option>`).join("") + "</select>";
  let html = `<nav><a href="${link({ today: "" })}"${route.today ? " aria-current=\"page\"" : ""}>today</a><a href="${link({ all: "" })}"${route.all ? " aria-current=\"page\"" : ""}>all</a>`
    + modules.map(module => `<a href="${link({ form: module.id })}"${module === selected ? " aria-current=\"page\"" : ""}>${module.id}</a>`).join("")
    + `<span class="switch"><a href="${link(here, { manner: route.manner === "lavis" ? "taille-douce" : "lavis" })}">${route.manner === "lavis" ? "taille-douce" : "lavis"}</a>`
    + (palette ? "" : `<a href="${link(here, { paper: route.paper === "night" ? "cream" : "night" })}">${route.paper === "night" ? "cream paper" : "night paper"}</a>`)
    + `${chooser}</span></nav>`;
  if (route.today) html += today(route.manner, route.date);
  else if (route.all) {
    html += `<div class="all">${modules.flatMap(module => module.examples.map(item =>
      figure(garden(module, item.variant, 0.7, route.manner, slug(`all-${module.id}-${item.name}`), 11), `${escape(item.name)}<br><small>${module.id}</small>`))).join("")}</div>`;
  } else if (selected) {
    html += `<header><h1>${selected.id}</h1><p>${escape(selected.doc)}</p><table><tbody>`
      + Object.entries(selected.variants).map(([key, spec]) => `<tr><th>${key}</th><td>${escape(spec.doc)}</td><td><code>${escape(spec.values ? spec.values.map(String).join(" | ") : spec.range?.join("..") ?? "")}</code> (default <code>${escape(String(spec.default))}</code>)</td></tr>`).join("")
      + "</tbody></table></header>"
      + selected.examples.map(item => example(selected, item.name, item.variant, route.manner)).join("");
  } else html += `<p>Choose a form above, or <a href="${link({ all: "" })}">all</a>, or <a href="${link({ today: "" })}">today</a>.</p>`;
  document.getElementById("gallery")!.innerHTML = html;
  document.getElementById("palette")?.addEventListener("change", event => {
    location.hash = link(here, { palette: (event.target as HTMLSelectElement).value || null });
  });
}

window.addEventListener("hashchange", draw);
draw();
