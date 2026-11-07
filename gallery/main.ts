// The gallery: every plant form's examples as gardens at bloom and at seed, with their bloom at bud,
// bloom and seed and their leaf drawn large, so a form's author can judge it by eye; and today's garden
// from the calendar through the day. `#form=<id>` opens one form, `#all` shows every example small,
// `#today` shows the calendar's day (`&date=YYYY-MM-DD` another day's), and `#festivals` the six complementary
// days of a sextile year through the day; `&manner=lavis` and `&paper=night` change the plate.
// `&palette=<id>-light` or `-dark` draws everything in one of the library's palettes.
import { calendarDay, figureURL, localDate } from "../src/calendar/index.js";
import type { FormModule, Variant } from "../src/form.js";
import { growGarden } from "../src/grow.js";
import type { Manner } from "../src/paint.js";
import { createRng, seedFromText } from "../src/random.js";
import { PALETTES, palettesCss } from "../src/palettes.js";
import { FORM_MODULES, plantForm } from "../src/registry.js";
import { renderGarden } from "../src/render.js";
import { shapesSvg } from "./drawing.js";

interface Route { form: string | null; all: boolean; today: boolean; festivals: boolean; date: string | null; manner: Manner; paper: "cream" | "night"; palette: string | null }

function readRoute(): Route {
  const params = new URLSearchParams(location.hash.slice(1));
  return {
    form: params.get("form"), all: params.has("all"), today: params.has("today"), festivals: params.has("festivals"), date: params.get("date"),
    manner: params.get("manner") === "lavis" ? "lavis" : "taille-douce", paper: params.get("paper") === "night" ? "night" : "cream",
    palette: params.get("palette"),
  };
}

const palettes = document.createElement("style");
palettes.textContent = palettesCss();
document.head.append(palettes);
/** Every palette in both readings, as `data-eglantine-palette` takes them. */
const READINGS = PALETTES.flatMap(palette => (["light", "dark"] as const).map(reading => ({ value: `${palette.id}-${reading}`, palette, reading })));

const escape = (text: string): string => text.replace(/[&<>"]/gu, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[c]!);

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

/** A calendar day's garden at four moments, from morning on a quiet start to the end of a full day, under a heading of the level given. */
function day(date: string, manner: Manner, id: string, heading: "h1" | "h2"): string {
  const entry = calendarDay(date);
  const grown = growGarden({
    seed: seedFromText(date), form: entry.plant.form, variant: entry.plant.variant,
    ...(entry.guest ? { guest: entry.guest } : {}), ...(entry.festival ? { festival: entry.festival } : {}),
  });
  const guestFigure = entry.guest ? figureURL(entry.guest.figure).href : undefined;
  const moments = [[0.1, 0.1], [0.4, 0.4], [0.7, 0.7], [0.97, 1]] as const;
  const about = entry.festival ? `the festival <code>${entry.festival}</code> done to ${escape(entry.plant.name)}` : `${escape(entry.plant.name)}, drawn by <code>${entry.plant.form}</code>${entry.guest ? `, with ${escape(entry.guest.name)}` : ""}`;
  return `<${heading}>${escape(entry.dateline)}${entry.festival ? "" : `: ${escape(entry.name)}`}</${heading}><p>${about}.</p><div class="row">`
    + moments.map(([t, fullness], k) => figure(renderGarden(grown, { t, fullness }, { manner, id: `${id}-${k}`, scale: 24, ...(guestFigure ? { guestFigure } : {}) }), `t ${t}, fullness ${fullness}`)).join("")
    + "</div>";
}

/** The complementary days of an CCXXXV, a sextile year, so the sixth, the Revolution's, falls too. */
const FESTIVAL_DATES = ["2027-09-19", "2027-09-20", "2027-09-21", "2027-09-22", "2027-09-23", "2027-09-24"];

function draw(): void {
  const route = readRoute();
  const chosen = READINGS.find(reading => reading.value === route.palette) ?? null;
  const root = document.documentElement;
  if (chosen) { root.dataset.eglantinePalette = chosen.value; delete root.dataset.paper; } else { delete root.dataset.eglantinePalette; root.dataset.paper = route.paper; }
  const modules = [...FORM_MODULES.values()].sort((a, b) => a.id.localeCompare(b.id));
  const selected = route.form ? FORM_MODULES.get(route.form) : undefined;
  const link = (place: Record<string, string>, change: Partial<Route> = {}): string => {
    const next = { ...route, ...change };
    return `#${new URLSearchParams({ ...place, manner: next.manner, paper: next.paper, ...(next.palette ? { palette: next.palette } : {}) })}`;
  };
  const here: Record<string, string> = route.form ? { form: route.form } : route.all ? { all: "" } : route.festivals ? { festivals: "" } : route.today ? { today: "", ...(route.date ? { date: route.date } : {}) } : {};
  const chooser = `<select id="palette" aria-label="Palette"><option value="">no palette</option>`
    + READINGS.map(({ value, palette, reading }) => `<option value="${value}"${value === chosen?.value ? " selected" : ""}>${escape(palette.name)}, ${reading === "light" ? "jour" : "chandelle"} (${value})</option>`).join("") + "</select>";
  let html = `<nav><a href="./">Playground</a><a href="${link({ today: "" })}"${route.today ? " aria-current=\"page\"" : ""}>today</a><a href="${link({ festivals: "" })}"${route.festivals ? " aria-current=\"page\"" : ""}>festivals</a><a href="${link({ all: "" })}"${route.all ? " aria-current=\"page\"" : ""}>all</a>`
    + modules.map(module => `<a href="${link({ form: module.id })}"${module === selected ? " aria-current=\"page\"" : ""}>${escape(module.name)}</a>`).join("")
    + `<span class="switch"><a href="${link(here, { manner: route.manner === "lavis" ? "taille-douce" : "lavis" })}">${route.manner === "lavis" ? "taille-douce" : "lavis"}</a>`
    + (chosen ? "" : `<a href="${link(here, { paper: route.paper === "night" ? "cream" : "night" })}">${route.paper === "night" ? "cream paper" : "night paper"}</a>`)
    + `${chooser}</span></nav>`
    + (chosen ? `<p class="palette-note"><i>${escape(chosen.palette.name)}</i>, ${escape(chosen.palette.period)}. ${escape(chosen.palette.note)}</p>` : "");
  if (route.today) html += day(route.date ?? localDate(Date.now(), Intl.DateTimeFormat().resolvedOptions().timeZone), route.manner, "today", "h1");
  else if (route.festivals) html += `<h1>The complementary days</h1>${FESTIVAL_DATES.map(date => day(date, route.manner, `festival-${date}`, "h2")).join("")}`;
  else if (route.all) {
    html += `<div class="all">${modules.flatMap(module => module.examples.map(item =>
      figure(garden(module, item.variant, 0.7, route.manner, slug(`all-${module.id}-${item.name}`), 11), `${escape(item.name)}<br><small>${escape(module.name)}</small>`))).join("")}</div>`;
  } else if (selected) {
    html += `<header><h1>${escape(selected.name)} <code>${selected.id}</code></h1><p>${escape(selected.doc)}</p><div class="variant-table" role="region" aria-label="Variants" tabindex="0"><table><tbody>`
      + Object.entries(selected.variants).map(([key, spec]) => `<tr><th>${key}</th><td>${escape(spec.doc)}</td><td><code>${escape(spec.values ? spec.values.map(String).join(" | ") : spec.range?.join("..") ?? "")}</code> (default <code>${escape(String(spec.default))}</code>)</td></tr>`).join("")
      + "</tbody></table></div></header>"
      + selected.examples.map(item => example(selected, item.name, item.variant, route.manner)).join("");
  } else html += `<p>Choose a form above, or <a href="${link({ all: "" })}">all</a>, <a href="${link({ today: "" })}">today</a> or <a href="${link({ festivals: "" })}">the festivals</a>.</p>`;
  document.getElementById("gallery")!.innerHTML = html;
  document.getElementById("palette")?.addEventListener("change", event => {
    location.hash = link(here, { palette: (event.target as HTMLSelectElement).value || null });
  });
}

window.addEventListener("hashchange", draw);
draw();
