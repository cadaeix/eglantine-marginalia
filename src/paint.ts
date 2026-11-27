// Eight manners for the same shapes. Taille-douce is the copperplate: paper-white forms with a fine
// outline, shade cut as hatching, stems in solid ink. Lavis is the wash: soot-brown bistre laid in
// transparent layers, darker in the shade and pooled at the edges, veins lifted out in paper. Pointillé is
// stipple engraving, as the plates after Redouté's lilies and roses were engraved: each form is modelled in dots
// of the wash's colour, thick in its shadow and at its rim and sparse across its lit side, inside a contour of
// finer dots. Crayon is the chalk manner François and Demarteau made in the 1750s to print chalk drawings: loose
// hatching along each form, a contour that is heavy on the shadowed side and skips on the lit one, and the
// paper's tooth showing through every stroke. Bois is the relief woodcut, the taille d'épargne Jean-Michel
// Papillon cut for eighteenth-century ornaments and almanacs: bold keyblock contours in letterpress ink,
// solid ink shadows cut back in white line with the gouge, white veins across the dark, and open black cuts
// on pale petals. Each manner is a row of STYLES, so another is another row. The screen manners, mosaïque, carreaux
// and nékyia, are of no period but this one; they are painted in screen.ts and load on their own (load-manner.ts).
// Colours are CSS custom properties with fallbacks (see inks.ts), so a page's stylesheet can retint them.
import { clamp, fine, inside, lerp, num, pointsPath, polyPath, type Pt, smoothPath, smoothstep } from "./geometry.js";
import { cellValue, Edges, variance } from "./grid.js";
import { inkRef } from "./inks.js";
import type { Body, Shape } from "./shapes.js";

const idPart = (value: string): string =>
  value.replace(/[^A-Za-z0-9-]/gu, character => `_${character.codePointAt(0)!.toString(16)}_`);

/** Collects clip paths and filters for one SVG; ids carry a prefix so several gardens can share a page. */
export class Sheet {
  readonly defs: string[] = [];
  #next = 0;
  readonly #prefix: string;
  constructor(readonly prefix: string) { this.#prefix = idPart(prefix); }
  id(kind: string): string { this.#next += 1; return `${this.#prefix}-${idPart(kind)}${this.#next}`; }
}

const INK = inkRef("ink"), PAPER = inkRef("paper"), ACCENT = inkRef("accent"), WASH = inkRef("wash");
const rings = (list: readonly Pt[][]): string => list.map(ring => polyPath(ring, true)).join("");
const cuts = (list: readonly Pt[][]): string => list.map(points => polyPath(points)).join("");
const curves = (list: readonly Pt[][]): string => list.map(points => smoothPath(points)).join("");
function dotsPath(points: readonly Pt[], radius: number): string {
  const r = fine(radius), d = fine(radius * 2);
  return points.map(([x, y]) => `M${num(x - radius)} ${num(y)}a${r} ${r} 0 1 0 ${d} 0a${r} ${r} 0 1 0 -${d} 0`).join("");
}

/**
 * A body's outline defined once in the sheet's defs, so its fill, clip and stroke reuse it instead of
 * repeating its path data, which is most of a garden's weight. The definition carries no paint of its own,
 * since a `<use>` keeps the attributes of what it copies.
 */
function outlineOf(body: Body, sheet: Sheet): string {
  const id = sheet.id("o");
  sheet.defs.push(`<path id="${id}" d="${smoothPath(body.outline, true, 0.9)}"/>`);
  return id;
}

function engraveBody(body: Body, sheet: Sheet): string {
  // With nothing cut between its fill and its outline, a body is one path painting both, in that order.
  if (body.tone === "accent") return `<path d="${smoothPath(body.outline, true, 0.9)}" fill="${ACCENT}" fill-opacity="0.82" stroke="${INK}" stroke-width="0.011"/>`;
  const stroke = ` stroke="${INK}" stroke-width="0.012" stroke-linejoin="round"`;
  let out: string;
  if (body.grain.length === 0) {
    out = `<path d="${smoothPath(body.outline, true, 0.9)}" fill="${PAPER}"${stroke}/>`;
  } else {
    const outline = outlineOf(body, sheet);
    const clip = sheet.id("c");
    sheet.defs.push(`<clipPath id="${clip}"><use href="#${outline}"/></clipPath>`);
    let hatching = `<path d="${cuts(body.grain)}" fill="none" stroke="${INK}" stroke-width="${fine(0.006 + 0.007 * body.weight)}" stroke-linecap="round"/>`;
    if (body.shadow.length > 0) {
      const shade = sheet.id("s");
      sheet.defs.push(`<clipPath id="${shade}"><path d="${rings(body.shadow)}" clip-rule="evenodd"/></clipPath>`);
      hatching = `<g clip-path="url(#${shade})">${hatching}</g>`;
    }
    out = `<use href="#${outline}" fill="${PAPER}"/><g clip-path="url(#${clip})">${hatching}</g><use href="#${outline}" fill="none"${stroke}/>`;
  }
  if (body.veins.length > 0) out += `<path d="${curves(body.veins)}" fill="none" stroke="${INK}" stroke-width="0.008" stroke-linecap="round"/>`;
  return out;
}

function washBody(body: Body, sheet: Sheet): string {
  if (body.tone === "accent") return `<path d="${smoothPath(body.outline, true, 0.9)}" fill="${ACCENT}" fill-opacity="0.55"/>`;
  const depth = 0.75 + 0.5 * variance(body);
  const fill = ` fill="${WASH}" fill-opacity="${num((0.14 + 0.22 * body.weight) * depth)}"`;
  const edge = ` stroke="${WASH}" stroke-opacity="0.38" stroke-width="0.022" stroke-linejoin="round"`;
  let out: string;
  // With no shadow laid between its wash and its pooled edge, a body is one path painting both, in that order.
  if (body.shadow.length === 0) {
    out = `<path d="${smoothPath(body.outline, true, 0.9)}"${fill}${edge}/>`;
  } else {
    const outline = outlineOf(body, sheet);
    const clip = sheet.id("c");
    sheet.defs.push(`<clipPath id="${clip}"><use href="#${outline}"/></clipPath>`);
    out = `<use href="#${outline}"${fill}/>`
      + `<g clip-path="url(#${clip})"><path d="${rings(body.shadow)}" fill="${WASH}" fill-opacity="${num(0.18 + 0.2 * body.weight)}" fill-rule="evenodd"/></g>`
      + `<use href="#${outline}" fill="none"${edge}/>`;
  }
  if (body.veins.length > 0) out += `<path d="${curves(body.veins)}" fill="none" stroke="${PAPER}" stroke-opacity="0.75" stroke-width="0.014" stroke-linecap="round"/>`;
  return out;
}

/** Stipple's grid, in centimetres: one dot may fall in each cell of it, somewhere inside the cell. Its grain is about the hatching's. */
const STIPPLE_CELL = 0.045;
/** How far in from a form's edge the stipple thickens into its rim, and how far either side of its shadow's edge the shade grades in, in centimetres. */
const STIPPLE_RIM = 0.08, STIPPLE_SOFT = 0.12;
/** How much the rim adds to a form's tone, at its very edge. */
const RIM_TONE = 0.5;
/** The widths of a dot across a form's lit side and in its shadow, and of a dot in its contour, in centimetres. */
const LIT_DOT = 0.024, SHADE_DOT = 0.032, CONTOUR_DOT = 0.02;
/** The contour is a row of dots this far apart, in centimetres, as an engraver etched it before stippling. */
const CONTOUR_STEP = 0.055;
/** How deeply an accented form is tinted with its colour under its dots. */
const ACCENT_TINT = 0.4;

/**
 * The dots that model a body. Each cell of a grid fixed to the page offers one dot, kept where the form reads
 * dark enough there: more in its shadow, the more so the heavier the form, and more towards its rim, so its
 * edge shows as a thickening of dots rather than a line. The cells' values come from their place and the form,
 * so the same form is always stippled alike and two forms over each other are stippled differently.
 */
function stipple(body: Body): { lit: Pt[]; dark: Pt[] } {
  const lit: Pt[] = [], dark: Pt[] = [];
  let bottom = Infinity, topmost = -Infinity;
  for (const point of body.outline) {
    bottom = Math.min(bottom, point[1]);
    topmost = Math.max(topmost, point[1]);
  }
  const salt = Math.floor(variance(body) * 1e6);
  const w = body.weight;
  const outline = new Edges([body.outline], STIPPLE_RIM);
  const shadow = body.shadow.length > 0 ? new Edges(body.shadow, STIPPLE_SOFT) : null;
  const maximumTone = 0.05 + 0.12 * w + (shadow ? 0.22 + 0.4 * w : 0) + RIM_TONE;
  // Each row of cells is walked only across the stretch the outline reaches within it, since a long form lying
  // aslant fills little of the box round it.
  const top = Math.floor(bottom / STIPPLE_CELL), rows = Math.ceil(topmost / STIPPLE_CELL) - top + 1;
  const from = new Array<number>(rows).fill(Infinity), to = new Array<number>(rows).fill(-Infinity);
  for (let k = 0, m = body.outline.length - 1; k < body.outline.length; m = k, k += 1) {
    const [ax, ay] = body.outline[m]!, [bx, by] = body.outline[k]!;
    for (let row = Math.floor(Math.min(ay, by) / STIPPLE_CELL) - top; row <= Math.floor(Math.max(ay, by) / STIPPLE_CELL) - top; row += 1) {
      from[row] = Math.min(from[row]!, ax, bx);
      to[row] = Math.max(to[row]!, ax, bx);
    }
  }
  for (let row = 0; row < rows; row += 1) {
    const j = top + row;
    for (let i = Math.floor(from[row]! / STIPPLE_CELL); i <= Math.floor(to[row]! / STIPPLE_CELL); i += 1) {
      const value = cellValue(i, j, salt + 2);
      // Even the deepest shadow and rim cannot keep this cell, so neither needs measuring.
      if (value >= maximumTone) continue;
      const x = (i + 0.1 + 0.8 * cellValue(i, j, salt)) * STIPPLE_CELL, y = (j + 0.1 + 0.8 * cellValue(i, j, salt + 1)) * STIPPLE_CELL;
      if (!outline.inside(x, y)) continue;
      // How deep in shade the point lies, graded in either side of the shadow's edge rather than stepping at it.
      let shade = 0;
      if (shadow) {
        const edge = smoothstep(0, STIPPLE_SOFT, shadow.distance(x, y, STIPPLE_SOFT));
        shade = shadow.inside(x, y) ? 0.5 + 0.5 * edge : 0.5 - 0.5 * edge;
      }
      // The tone without the rim, which adds up to RIM_TONE more: the rim is measured only where it decides.
      const tone = 0.05 + 0.12 * w + shade * (0.22 + 0.4 * w);
      if (value >= tone + RIM_TONE) continue;
      if (value >= tone && value >= tone + RIM_TONE * (1 - smoothstep(0, STIPPLE_RIM, outline.distance(x, y, STIPPLE_RIM)))) continue;
      (shade > 0.5 ? dark : lit).push([x, y]);
    }
  }
  return { lit, dark };
}

function stippleBody(body: Body, sheet: Sheet): string {
  const accent = body.tone === "accent", colour = accent ? ACCENT : WASH;
  const { lit, dark } = stipple(body);
  const dots = (points: readonly Pt[], width: number): string => points.length === 0 ? ""
    : `<path d="${pointsPath(points)}" fill="none" stroke="${colour}" stroke-width="${fine(width)}" stroke-linecap="round"/>`;
  const contour = ` stroke="${colour}" stroke-width="${fine(CONTOUR_DOT)}" stroke-dasharray="0 ${fine(CONTOUR_STEP)}" stroke-linecap="round"`;
  // The paper the form is cut from, with its contour dotted round it. An accented form, a hip or a berry, is
  // tinted with its colour under its dots, as a colour stipple was inked on the plate à la poupée.
  let out: string;
  if (accent) {
    const outline = outlineOf(body, sheet);
    out = `<use href="#${outline}" fill="${PAPER}"/><use href="#${outline}" fill="${ACCENT}" fill-opacity="${num(ACCENT_TINT)}"${contour}/>`;
  } else {
    out = `<path d="${smoothPath(body.outline, true, 0.9)}" fill="${PAPER}"${contour}/>`;
  }
  out += dots(lit, LIT_DOT) + dots(dark, SHADE_DOT);
  if (body.veins.length > 0) out += `<path d="${curves(body.veins)}" fill="none" stroke="${colour}" stroke-width="0.012" stroke-dasharray="0 0.03" stroke-linecap="round"/>`;
  return out;
}

/** Chalk's hatching is this wide on the lightest form and on the heaviest, in centimetres. */
const CHALK_HATCH = [0.016, 0.026] as const;
/** The contour's width on a form's lit side and on its shadowed one, in centimetres. */
const CHALK_LIT = 0.014, CHALK_SHADE = 0.04;
/** On the lit side the contour breaks as the chalk skips over the paper: its strokes and gaps, in centimetres. */
const CHALK_SKIP = "0.24 0.05 0.11 0.04";
/** How deeply an accented form is coloured, as a pastel. */
const PASTEL = 0.6;

function chalkBody(body: Body, sheet: Sheet): string {
  const outline = outlineOf(body, sheet);
  // An accented form, a hip or a berry, is laid in colour, as the pastel manner printed it.
  if (body.tone === "accent") return `<use href="#${outline}" fill="${PAPER}"/><use href="#${outline}" fill="${ACCENT}" fill-opacity="${num(PASTEL)}" stroke="${ACCENT}" stroke-width="${fine(CHALK_LIT)}"/>`;
  let out = `<use href="#${outline}" fill="${PAPER}"/>`;
  if (body.shadow.length > 0) {
    const shade = sheet.id("s");
    sheet.defs.push(`<clipPath id="${shade}"><path d="${rings(body.shadow)}" clip-rule="evenodd"/></clipPath>`);
    let strokes = "";
    if (body.grain.length > 0) {
      const clip = sheet.id("c");
      sheet.defs.push(`<clipPath id="${clip}"><use href="#${outline}"/></clipPath>`);
      strokes += `<g clip-path="url(#${clip})"><path d="${cuts(body.grain)}" fill="none" stroke="${WASH}" stroke-opacity="0.85" stroke-width="${fine(lerp(...CHALK_HATCH, body.weight))}" stroke-linecap="round"/></g>`;
    }
    // The contour weighs on the shadowed side, as a draughtsman presses there.
    strokes += `<use href="#${outline}" fill="none" stroke="${WASH}" stroke-width="${fine(CHALK_SHADE)}" stroke-linejoin="round"/>`;
    out += `<g clip-path="url(#${shade})">${strokes}</g>`;
  }
  out += `<use href="#${outline}" fill="none" stroke="${WASH}" stroke-width="${fine(CHALK_LIT)}" stroke-dasharray="${CHALK_SKIP}" stroke-linecap="round"/>`;
  if (body.veins.length > 0) out += `<path d="${curves(body.veins)}" fill="none" stroke="${WASH}" stroke-opacity="0.7" stroke-width="0.01" stroke-linecap="round"/>`;
  return out;
}

/** Woodcut's contour on the lit side and its heavier keyblock edge on the shadowed side, in centimetres. */
const WOOD_LIT = 0.02, WOOD_SHADE = 0.036;
/** Forms at least this heavy print solid ink in their shadow, cut back in white line with the gouge. */
const WOOD_SOLID = 0.48;
/** Flat faces without a separate shadow go solid ink and white-line above this weight. */
const WOOD_FLAT_DARK = 0.68;
/** Width of white-line gouge cuts from medium to darkest forms, and of black cuts on light forms, in centimetres. */
const WOOD_GOUGE = [0.026, 0.013] as const;
const WOOD_CUT = [0.014, 0.021] as const;

/** A woodblock cannot hold copperplate's close spacing: keep every other cut when a form has many. */
const spacedGrain = (grain: readonly Pt[][]): readonly Pt[][] =>
  grain.length > 5 ? grain.filter((_, index) => index % 2 === 0) : grain;

function woodcutBody(body: Body, sheet: Sheet): string {
  const stroke = ` stroke="${INK}" stroke-width="${fine(WOOD_LIT)}" stroke-linejoin="round"`;
  // An accented form is printed from a second rubricated block inside the ink keyblock, with black cuts in its shade.
  if (body.tone === "accent") {
    if (body.shadow.length === 0 || body.grain.length === 0) {
      return `<path d="${smoothPath(body.outline, true, 0.9)}" fill="${ACCENT}"${stroke}/>`;
    }
    const outline = outlineOf(body, sheet);
    const clip = sheet.id("c"), shade = sheet.id("s");
    sheet.defs.push(`<clipPath id="${clip}"><use href="#${outline}"/></clipPath>`);
    sheet.defs.push(`<clipPath id="${shade}"><path d="${rings(body.shadow)}" clip-rule="evenodd"/></clipPath>`);
    const hatching = `<path d="${cuts(spacedGrain(body.grain))}" fill="none" stroke="${INK}" stroke-width="${fine(WOOD_CUT[0])}" stroke-linecap="round"/>`;
    return `<use href="#${outline}" fill="${ACCENT}"/><g clip-path="url(#${clip})"><g clip-path="url(#${shade})">${hatching}</g></g><use href="#${outline}" fill="none"${stroke}/>`;
  }
  if (body.shadow.length === 0) {
    if (body.grain.length === 0) {
      let out = `<path d="${smoothPath(body.outline, true, 0.9)}" fill="${PAPER}"${stroke}/>`;
      if (body.veins.length > 0) out += `<path d="${curves(body.veins)}" fill="none" stroke="${INK}" stroke-width="0.013" stroke-linecap="round"/>`;
      return out;
    }
    const outline = outlineOf(body, sheet);
    const clip = sheet.id("c");
    sheet.defs.push(`<clipPath id="${clip}"><use href="#${outline}"/></clipPath>`);
    if (body.weight >= WOOD_FLAT_DARK) {
      const gouge = lerp(...WOOD_GOUGE, clamp((body.weight - WOOD_FLAT_DARK) / (1 - WOOD_FLAT_DARK), 0, 1));
      let insideBlock = `<path d="${cuts(spacedGrain(body.grain))}" fill="none" stroke="${PAPER}" stroke-width="${fine(gouge)}" stroke-linecap="round"/>`;
      if (body.veins.length > 0) insideBlock += `<path d="${curves(body.veins)}" fill="none" stroke="${PAPER}" stroke-width="0.015" stroke-linecap="round"/>`;
      return `<use href="#${outline}" fill="${INK}"/><g clip-path="url(#${clip})">${insideBlock}</g><use href="#${outline}" fill="none"${stroke}/>`;
    }
    const width = lerp(...WOOD_CUT, clamp(body.weight / WOOD_FLAT_DARK, 0, 1));
    let out = `<use href="#${outline}" fill="${PAPER}"/><g clip-path="url(#${clip})"><path d="${cuts(spacedGrain(body.grain))}" fill="none" stroke="${INK}" stroke-width="${fine(width)}" stroke-linecap="round"/></g><use href="#${outline}" fill="none"${stroke}/>`;
    if (body.veins.length > 0) out += `<path d="${curves(body.veins)}" fill="none" stroke="${INK}" stroke-width="0.013" stroke-linecap="round"/>`;
    return out;
  }
  const outline = outlineOf(body, sheet);
  const clip = sheet.id("c"), shade = sheet.id("s");
  sheet.defs.push(`<clipPath id="${clip}"><use href="#${outline}"/></clipPath>`);
  sheet.defs.push(`<clipPath id="${shade}"><path d="${rings(body.shadow)}" clip-rule="evenodd"/></clipPath>`);
  if (body.weight >= WOOD_SOLID) {
    // Leaves, fruits and dark forms keep a solid black shadow cut back with white gouge strokes and white veins.
    const gouge = lerp(...WOOD_GOUGE, clamp((body.weight - WOOD_SOLID) / (1 - WOOD_SOLID), 0, 1));
    let lit = `<use href="#${outline}" fill="${PAPER}"/>`;
    if (body.veins.length > 0) lit += `<path d="${curves(body.veins)}" fill="none" stroke="${INK}" stroke-width="0.013" stroke-linecap="round"/>`;
    let dark = `<use href="#${outline}" fill="${INK}"/>`;
    if (body.grain.length > 0) dark += `<path d="${cuts(spacedGrain(body.grain))}" fill="none" stroke="${PAPER}" stroke-width="${fine(gouge)}" stroke-linecap="round"/>`;
    if (body.veins.length > 0) dark += `<path d="${curves(body.veins)}" fill="none" stroke="${PAPER}" stroke-width="0.015" stroke-linecap="round"/>`;
    return `${lit}<g clip-path="url(#${clip})"><g clip-path="url(#${shade})">${dark}</g></g><use href="#${outline}" fill="none"${stroke}/>`;
  }
  // Light petals and pale forms keep their paper white, shaded with open black woodcut cuts and a heavier shadowed rim.
  let shaded = "";
  if (body.grain.length > 0) {
    const width = lerp(...WOOD_CUT, clamp(body.weight / WOOD_SOLID, 0, 1));
    shaded += `<g clip-path="url(#${clip})"><path d="${cuts(spacedGrain(body.grain))}" fill="none" stroke="${INK}" stroke-width="${fine(width)}" stroke-linecap="round"/></g>`;
  }
  shaded += `<use href="#${outline}" fill="none" stroke="${INK}" stroke-width="${fine(WOOD_SHADE)}" stroke-linejoin="round"/>`;
  let out = `<use href="#${outline}" fill="${PAPER}"/><g clip-path="url(#${shade})">${shaded}</g><use href="#${outline}" fill="none"${stroke}/>`;
  if (body.veins.length > 0) out += `<path d="${curves(body.veins)}" fill="none" stroke="${INK}" stroke-width="0.012" stroke-linecap="round"/>`;
  return out;
}

/** Which part of the plant a motif is: its blooms, with their fruit and shed petals; its leaves; its stems; or the foot it stands on. */
export type Part = "bloom" | "leaf" | "stem" | "foot";

/** How a manner paints: its modelled forms, and the ink its solids, lines and dots take when they are not accented. */
export interface MannerStyle {
  body(body: Body, sheet: Sheet): string;
  /** The attributes that ink a solid's fill, a line's stroke and dots' fill. */
  readonly solid: string;
  readonly line: string;
  readonly dots: string;
  /** The attributes that ink a guest's engraving, which is drawn as a mask. */
  readonly figure: string;
  /** A filter laid over the whole garden, giving its id. */
  filter?(sheet: Sheet, seed: number): string;
  /** Paints a motif's shapes all at once, in place of painting them one by one, knowing which part of the plant they are. */
  paint?(shapes: readonly Shape[], sheet: Sheet, part: Part): string;
  /** Wants its shapes in the page's frame rather than each motif's own, as a grid fixed to the page needs. */
  readonly upright?: boolean;
}

const STYLES = {
  "taille-douce": { body: engraveBody, solid: ` fill="${INK}"`, line: ` stroke="${INK}"`, dots: ` fill="${INK}"`, figure: `fill="${INK}"` },
  lavis: {
    body: washBody, solid: ` fill="${WASH}" fill-opacity="0.82"`, line: ` stroke="${WASH}" stroke-opacity="0.85"`, dots: ` fill="${WASH}"`,
    figure: `fill="${WASH}" fill-opacity="0.85"`, filter: washFilter,
  },
  // Stems are eased back a little, as the wash's are, so they sit with the dots rather than over them.
  pointille: { body: stippleBody, solid: ` fill="${WASH}" fill-opacity="0.85"`, line: ` stroke="${WASH}" stroke-opacity="0.85"`, dots: ` fill="${WASH}"`, figure: `fill="${WASH}"` },
  crayon: { body: chalkBody, solid: ` fill="${WASH}" fill-opacity="0.9"`, line: ` stroke="${WASH}" stroke-opacity="0.9"`, dots: ` fill="${WASH}"`, figure: `fill="${WASH}"`, filter: chalkFilter },
  bois: { body: woodcutBody, solid: ` fill="${INK}"`, line: ` stroke="${INK}"`, dots: ` fill="${INK}"`, figure: `fill="${INK}"`, filter: woodFilter },
} as const satisfies Record<string, MannerStyle>;

/** The period manners a garden can be painted in here. The screen manners are painted in screen.ts. */
export type PeriodManner = keyof typeof STYLES;
/** The screen manners, which load on their own: see load-manner.ts. */
export type ScreenManner = "mosaique" | "carreaux" | "nekyia";
export type Manner = PeriodManner | ScreenManner;
/** The manners a garden can be drawn in, listed by hand: the five period manners, then the three screen manners. */
export const MANNERS: readonly Manner[] = ["taille-douce", "lavis", "pointille", "crayon", "bois", "mosaique", "carreaux", "nekyia"];

/** A manner ready to paint: its id and its style, as `loadManner` gives it. */
export interface MannerModule extends MannerStyle {
  readonly id: Manner;
}
/** A manner as painting takes it: a period manner by its id, or any manner loaded. */
export type MannerInput = PeriodManner | MannerModule;

/** A manner's style. A screen manner named by its id alone is refused here, since it is painted only once loaded. */
export function mannerStyle(manner: MannerInput): MannerStyle {
  if (typeof manner !== "string") return manner;
  if (Object.hasOwn(STYLES, manner)) return STYLES[manner];
  throw new RangeError((MANNERS as readonly string[]).includes(manner)
    ? `${manner} is a screen manner: load it with loadManner, or draw it from the main entry`
    : `A manner is one of ${MANNERS.join(", ")}, not ${String(manner)}`);
}

/** A period manner as a module, the shape a loaded manner takes. */
export function periodManner(id: PeriodManner): MannerModule {
  return { id, ...mannerStyle(id) };
}

/** A motif's shapes in a manner, as `part` of the plant: a manner may paint blooms apart from the rest. */
export function paintShapes(shapes: readonly Shape[], manner: MannerInput, sheet: Sheet, part: Part = "leaf"): string {
  const style = mannerStyle(manner);
  if (style.paint) return style.paint(shapes, sheet, part);
  let out = "";
  // Neighbouring paths with the same attributes share one group that carries them, since the attributes
  // are most of a stroke's markup. A group with no opacity or filter of its own paints its children
  // exactly as it would paint them alone, so overlapping washes still darken where they cross.
  let run: string[] = [], runAttributes = "";
  const flush = (): void => {
    if (run.length === 1) out += `<path d="${run[0]}"${runAttributes}/>`;
    else if (run.length > 1) out += `<g${runAttributes}>${run.map(d => `<path d="${d}"/>`).join("")}</g>`;
    run = [];
  };
  const path = (d: string, attributes: string): void => {
    if (attributes !== runAttributes) { flush(); runAttributes = attributes; }
    run.push(d);
  };
  for (const shape of shapes) {
    const accent = shape.tone === "accent";
    switch (shape.type) {
      case "body":
        flush();
        out += style.body(shape, sheet);
        break;
      case "solid":
        path(shape.smooth === false ? polyPath(shape.outline, true) : smoothPath(shape.outline, true, 0.9), accent ? ` fill="${ACCENT}"` : style.solid);
        break;
      case "line":
        path(shape.smooth === false ? polyPath(shape.points) : smoothPath(shape.points),
          ` fill="none"${accent ? ` stroke="${ACCENT}"` : style.line} stroke-width="${fine(shape.width)}" stroke-linecap="round" stroke-linejoin="round"`);
        break;
      case "dots":
        path(dotsPath(shape.points, shape.radius), accent ? ` fill="${ACCENT}"` : style.dots);
        break;
    }
  }
  flush();
  return out;
}

/** The wash's soft, slightly bled edge: one displacement filter per sheet. */
function washFilter(sheet: Sheet, seed: number): string {
  const id = sheet.id("bleed");
  sheet.defs.push(`<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="3.2" numOctaves="2" seed="${seed % 1000}"/><feDisplacementMap in="SourceGraphic" scale="0.05" xChannelSelector="R" yChannelSelector="G"/></filter>`);
  return id;
}

/** The paper's tooth: how fine its grain is, in cycles a centimetre, and how much of it shows through the chalk. */
const TOOTH = 18, TOOTH_GAIN = 6, TOOTH_OFFSET = -2.8;

/**
 * The paper's tooth showing through the chalk: specks of the paper, from noise as fine as a sheet's grain, laid
 * over everything drawn and nowhere else. One filter per sheet; a paper-white form shows no specks on itself.
 */
function chalkFilter(sheet: Sheet, seed: number): string {
  const id = sheet.id("tooth");
  sheet.defs.push(`<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">`
    + `<feTurbulence type="fractalNoise" baseFrequency="${TOOTH}" numOctaves="2" seed="${seed % 1000}" result="noise"/>`
    + `<feColorMatrix in="noise" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${TOOTH_GAIN} 0 0 0 ${TOOTH_OFFSET}" result="tooth"/>`
    + `<feFlood flood-color="${PAPER}"/><feComposite in2="tooth" operator="in"/><feComposite in2="SourceAlpha" operator="in" result="specks"/>`
    + `<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="specks"/></feMerge></filter>`);
  return id;
}

/** The pearwood block's faint press bite and wood grain showing through heavy ink. */
const WOOD_GRAIN_X = 4.5, WOOD_GRAIN_Y = 20, WOOD_GAIN = 5.5, WOOD_OFFSET = -3.35;

/**
 * The slight irregularity of a carved woodblock inked on laid paper: a tiny displacement gives strokes the
 * knife's edge, and faint horizontal wood-grain specks break the broadest solids without softening the cut.
 */
function woodFilter(sheet: Sheet, seed: number): string {
  const id = sheet.id("wood");
  sheet.defs.push(`<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">`
    + `<feTurbulence type="fractalNoise" baseFrequency="${WOOD_GRAIN_X} ${WOOD_GRAIN_Y}" numOctaves="2" seed="${seed % 1000}" result="grain"/>`
    + `<feDisplacementMap in="SourceGraphic" in2="grain" scale="0.022" xChannelSelector="R" yChannelSelector="G" result="cut"/>`
    + `<feColorMatrix in="grain" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${WOOD_GAIN} 0 0 0 ${WOOD_OFFSET}" result="speckMask"/>`
    + `<feFlood flood-color="${PAPER}"/><feComposite in2="speckMask" operator="in"/><feComposite in2="cut" operator="in" result="specks"/>`
    + `<feMerge><feMergeNode in="cut"/><feMergeNode in="specks"/></feMerge></filter>`);
  return id;
}
