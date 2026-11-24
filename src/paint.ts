// Three manners for the same shapes. Taille-douce is the copperplate: paper-white forms with a fine
// outline, shade cut as hatching, stems in solid ink. Lavis is the wash: soot-brown bistre laid in
// transparent layers, darker in the shade and pooled at the edges, veins lifted out in paper. Pointillé is
// stipple engraving, as the plates after Redouté's lilies and roses were engraved: each form is modelled in dots
// of the wash's colour, thick in its shadow and at its rim and sparse across its lit side, inside a contour of
// finer dots. Each manner is a row of STYLES, so another is another row.
// Colours are CSS custom properties with fallbacks (see inks.ts), so a page's stylesheet can retint them.
import { fine, inside, num, pointsPath, polyPath, type Pt, smoothPath, smoothstep } from "./geometry.js";
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

/** A stable 0..1 value from a form's first point, so each wash lies a little lighter or darker. */
function variance(body: Body): number {
  const [x = 0, y = 0] = body.outline[0] ?? [];
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
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

/** A stable 0..1 value for a cell of the stipple's grid, one for each salt. */
function cellValue(i: number, j: number, salt: number): number {
  let h = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(salt, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The height of the bands a form's edges are sorted into, in centimetres. */
const EDGE_BAND = 0.1;

/**
 * The edges of a form's rings sorted into bands across the page, so a point is measured against only the edges
 * near its height rather than every edge of the form: most cells of the stipple's grid lie far from any.
 */
class Edges {
  /** Each band's edges, four numbers to an edge: its start's x and y, then its end's. */
  readonly #bands: number[][] = [];
  readonly #first: number;
  constructor(rings: readonly (readonly Pt[])[], reach: number) {
    const ys = rings.flatMap(ring => ring.map(p => p[1]));
    this.#first = Math.floor((Math.min(...ys) - reach) / EDGE_BAND);
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
        const [ax, ay] = ring[j]!, [bx, by] = ring[i]!;
        // An edge goes into every band within `reach` of it, so a point finds every edge it is measured against.
        const from = Math.floor((Math.min(ay, by) - reach) / EDGE_BAND) - this.#first, to = Math.floor((Math.max(ay, by) + reach) / EDGE_BAND) - this.#first;
        for (let band = from; band <= to; band += 1) (this.#bands[band] ??= []).push(ax, ay, bx, by);
      }
    }
  }

  #near(y: number): readonly number[] {
    return this.#bands[Math.floor(y / EDGE_BAND) - this.#first] ?? [];
  }

  /** Whether a point lies inside the rings, by the even-odd rule. */
  inside(x: number, y: number): boolean {
    const edges = this.#near(y);
    let hit = false;
    for (let k = 0; k < edges.length; k += 4) {
      const ax = edges[k]!, ay = edges[k + 1]!, bx = edges[k + 2]!, by = edges[k + 3]!;
      if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) hit = !hit;
    }
    return hit;
  }

  /** How far a point lies from the nearest edge, up to the reach the edges were sorted for. */
  distance(x: number, y: number, reach: number): number {
    const edges = this.#near(y);
    let least = reach;
    for (let k = 0; k < edges.length; k += 4) {
      const ax = edges[k]!, ay = edges[k + 1]!, bx = edges[k + 2]!, by = edges[k + 3]!;
      if (Math.min(ax, bx) - x > least || x - Math.max(ax, bx) > least) continue;
      const dx = bx - ax, dy = by - ay, length = dx * dx + dy * dy;
      const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / length));
      least = Math.min(least, Math.hypot(x - ax - dx * t, y - ay - dy * t));
    }
    return least;
  }
}

/**
 * The dots that model a body. Each cell of a grid fixed to the page offers one dot, kept where the form reads
 * dark enough there: more in its shadow, the more so the heavier the form, and more towards its rim, so its
 * edge shows as a thickening of dots rather than a line. The cells' values come from their place and the form,
 * so the same form is always stippled alike and two forms over each other are stippled differently.
 */
function stipple(body: Body): { lit: Pt[]; dark: Pt[] } {
  const lit: Pt[] = [], dark: Pt[] = [];
  const ys = body.outline.map(p => p[1]);
  const salt = Math.floor(variance(body) * 1e6);
  const w = body.weight;
  const outline = new Edges([body.outline], STIPPLE_RIM);
  const shadow = body.shadow.length > 0 ? new Edges(body.shadow, STIPPLE_SOFT) : null;
  // Each row of cells is walked only across the stretch the outline reaches within it, since a long form lying
  // aslant fills little of the box round it.
  const top = Math.floor(Math.min(...ys) / STIPPLE_CELL), rows = Math.ceil(Math.max(...ys) / STIPPLE_CELL) - top + 1;
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
      const x = (i + 0.1 + 0.8 * cellValue(i, j, salt)) * STIPPLE_CELL, y = (j + 0.1 + 0.8 * cellValue(i, j, salt + 1)) * STIPPLE_CELL;
      if (!outline.inside(x, y)) continue;
      // How deep in shade the point lies, graded in either side of the shadow's edge rather than stepping at it.
      let shade = 0;
      if (shadow) {
        const edge = smoothstep(0, STIPPLE_SOFT, shadow.distance(x, y, STIPPLE_SOFT));
        shade = shadow.inside(x, y) ? 0.5 + 0.5 * edge : 0.5 - 0.5 * edge;
      }
      // The tone without the rim, which adds up to RIM_TONE more: the rim is measured only where it decides.
      const tone = 0.05 + 0.12 * w + shade * (0.22 + 0.4 * w), value = cellValue(i, j, salt + 2);
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
}

const STYLES = {
  "taille-douce": { body: engraveBody, solid: ` fill="${INK}"`, line: ` stroke="${INK}"`, dots: ` fill="${INK}"`, figure: `fill="${INK}"` },
  lavis: {
    body: washBody, solid: ` fill="${WASH}" fill-opacity="0.82"`, line: ` stroke="${WASH}" stroke-opacity="0.85"`, dots: ` fill="${WASH}"`,
    figure: `fill="${WASH}" fill-opacity="0.85"`, filter: washFilter,
  },
  // Stems are eased back a little, as the wash's are, so they sit with the dots rather than over them.
  pointille: { body: stippleBody, solid: ` fill="${WASH}" fill-opacity="0.85"`, line: ` stroke="${WASH}" stroke-opacity="0.85"`, dots: ` fill="${WASH}"`, figure: `fill="${WASH}"` },
} as const satisfies Record<string, MannerStyle>;

export type Manner = keyof typeof STYLES;
/** The manners a garden can be drawn in. */
export const MANNERS = Object.keys(STYLES) as readonly Manner[];

/** A manner's style; a manner it does not know is refused. */
export function mannerStyle(manner: Manner): MannerStyle {
  if (!Object.hasOwn(STYLES, manner)) throw new RangeError(`A manner is one of ${MANNERS.join(", ")}, not ${String(manner)}`);
  return STYLES[manner];
}

export function paintShapes(shapes: readonly Shape[], manner: Manner, sheet: Sheet): string {
  const style = mannerStyle(manner);
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
