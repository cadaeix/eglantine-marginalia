// Two manners for the same shapes. Taille-douce is the copperplate: paper-white forms with a fine
// outline, shade cut as hatching, stems in solid ink. Lavis is the wash: soot-brown bistre laid in
// transparent layers, darker in the shade and pooled at the edges, veins lifted out in paper.
// Colours are CSS custom properties with fallbacks (see inks.ts), so a page's stylesheet can retint them.
import { fine, num, polyPath, type Pt, smoothPath } from "./geometry.js";
import { inkRef } from "./inks.js";
import type { Body, Shape } from "./shapes.js";

export type Manner = "taille-douce" | "lavis";

/** Collects clip paths and filters for one SVG; ids carry a prefix so several gardens can share a page. */
export class Sheet {
  readonly defs: string[] = [];
  #next = 0;
  constructor(readonly prefix: string) {}
  id(kind: string): string { this.#next += 1; return `${this.prefix}-${kind}${this.#next}`; }
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
 * repeating its path data, which is most of a garden's weight.
 */
function outlineOf(body: Body, sheet: Sheet): string {
  const id = sheet.id("o");
  sheet.defs.push(`<path id="${id}" d="${smoothPath(body.outline, true, 0.9)}"/>`);
  return id;
}

function engraveBody(body: Body, sheet: Sheet): string {
  const outline = outlineOf(body, sheet);
  if (body.tone === "accent") {
    return `<use href="#${outline}" fill="${ACCENT}" fill-opacity="0.82"/><use href="#${outline}" fill="none" stroke="${INK}" stroke-width="0.011"/>`;
  }
  let out = `<use href="#${outline}" fill="${PAPER}"/>`;
  if (body.grain.length > 0) {
    const clip = sheet.id("c");
    sheet.defs.push(`<clipPath id="${clip}"><use href="#${outline}"/></clipPath>`);
    let hatching = `<path d="${cuts(body.grain)}" fill="none" stroke="${INK}" stroke-width="${fine(0.006 + 0.007 * body.weight)}" stroke-linecap="round"/>`;
    if (body.shadow.length > 0) {
      const shade = sheet.id("s");
      sheet.defs.push(`<clipPath id="${shade}"><path d="${rings(body.shadow)}" clip-rule="evenodd"/></clipPath>`);
      hatching = `<g clip-path="url(#${shade})">${hatching}</g>`;
    }
    out += `<g clip-path="url(#${clip})">${hatching}</g>`;
  }
  out += `<use href="#${outline}" fill="none" stroke="${INK}" stroke-width="0.012" stroke-linejoin="round"/>`;
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
  const outline = outlineOf(body, sheet);
  const depth = 0.75 + 0.5 * variance(body);
  let out = `<use href="#${outline}" fill="${WASH}" fill-opacity="${num((0.14 + 0.22 * body.weight) * depth)}"/>`;
  if (body.shadow.length > 0) {
    const clip = sheet.id("c");
    sheet.defs.push(`<clipPath id="${clip}"><use href="#${outline}"/></clipPath>`);
    out += `<g clip-path="url(#${clip})"><path d="${rings(body.shadow)}" fill="${WASH}" fill-opacity="${num(0.18 + 0.2 * body.weight)}" fill-rule="evenodd"/></g>`;
  }
  out += `<use href="#${outline}" fill="none" stroke="${WASH}" stroke-opacity="0.38" stroke-width="0.022" stroke-linejoin="round"/>`;
  if (body.veins.length > 0) out += `<path d="${curves(body.veins)}" fill="none" stroke="${PAPER}" stroke-opacity="0.75" stroke-width="0.014" stroke-linecap="round"/>`;
  return out;
}

export function paintShapes(shapes: readonly Shape[], manner: Manner, sheet: Sheet): string {
  let out = "";
  for (const shape of shapes) {
    switch (shape.type) {
      case "body":
        out += manner === "taille-douce" ? engraveBody(shape, sheet) : washBody(shape, sheet);
        break;
      case "solid": {
        const colour = shape.tone === "accent" ? ACCENT : manner === "taille-douce" ? INK : WASH;
        const opacity = manner === "taille-douce" || shape.tone === "accent" ? "" : ` fill-opacity="0.82"`;
        out += `<path d="${shape.smooth === false ? polyPath(shape.outline, true) : smoothPath(shape.outline, true, 0.9)}" fill="${colour}"${opacity}/>`;
        break;
      }
      case "line": {
        const colour = shape.tone === "accent" ? ACCENT : manner === "taille-douce" ? INK : WASH;
        const opacity = manner === "lavis" && shape.tone !== "accent" ? ` stroke-opacity="0.85"` : "";
        out += `<path d="${shape.smooth === false ? polyPath(shape.points) : smoothPath(shape.points)}" fill="none" stroke="${colour}"${opacity} stroke-width="${fine(shape.width)}" stroke-linecap="round" stroke-linejoin="round"/>`;
        break;
      }
      case "dots": {
        const colour = shape.tone === "accent" ? ACCENT : manner === "taille-douce" ? INK : WASH;
        out += `<path d="${dotsPath(shape.points, shape.radius)}" fill="${colour}"/>`;
        break;
      }
    }
  }
  return out;
}

/** The wash's soft, slightly bled edge: one displacement filter per sheet. */
export function washFilter(sheet: Sheet, seed: number): string {
  const id = sheet.id("bleed");
  sheet.defs.push(`<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="3.2" numOctaves="2" seed="${seed % 1000}"/><feDisplacementMap in="SourceGraphic" scale="0.05" xChannelSelector="R" yChannelSelector="G"/></filter>`);
  return id;
}
