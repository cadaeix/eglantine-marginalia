// A garden at one moment of the day, as one SVG.
import { num, prefix, type Pt, ribbon, smoothstep } from "./geometry.js";
import { type Garden, type MotifItem, stageAt, stemShown } from "./garden.js";
import { inkRef } from "./inks.js";
import { type Manner, paintShapes, Sheet, washFilter } from "./paint.js";
import { createRng } from "./random.js";
import type { Shape } from "./shapes.js";

export interface Moment {
  /** The time of day, 0 at its start and 1 at its end: brings the stems and the blooms' season. */
  t: number;
  /** How full the day is, 0 empty and 1 full: brings the leaves, the mycelium, the crystals in the rock. */
  fullness: number;
}

/** A mark painted among the garden's layers, so it lies over some parts of the plant and under others. */
export interface Inlay {
  /**
   * Where it lies: the foot is at 1.8, stems at 2, a tool at rest at 2.6, leaves at 3, airy motifs at 4,
   * blooms at 5 and a visiting animal at 6.
   */
  layer: number;
  svg: string;
}

/**
 * Marks a caller lays on the garden. Inlays take the lavis wash with the plant; `under` lies beneath the
 * whole garden and `over` above it, both outside the wash. Paint them with `paintShapes` on the sheet given,
 * so their ids stay unique within the SVG.
 */
export interface Decorations {
  inlays?: readonly Inlay[];
  under?: string;
  over?: string;
}

export interface RenderOptions {
  manner: Manner;
  /** Prefix for the SVG's internal ids, unique among the gardens on one page. */
  id: string;
  /** Pixels per centimetre. */
  scale: number;
  /**
   * The guest's engraving as a URL or data URI: a PNG whose ink is opaque and whose paper is transparent,
   * drawn facing +x. It is used as a mask, so it takes the manner's ink. A garden shown as an image needs a data URI.
   */
  guestFigure?: string;
  /**
   * Hangs the garden upside down from the top of its column, for a margin that begins under a page's header.
   * The root, and any foot the plant stands on, is cropped away above, so the SVG is shorter than the garden by
   * that much. A hanging garden draws no guest, which would hang upside down with it: grow it without one, and
   * its leaves fill the guest's room, with no empty shoots left where animals would have stood. A garden grown
   * round a page cannot hang, since its runner and arcs would turn over onto the text.
   */
  hanging?: boolean;
  /** Marks to lay on the garden at this moment. */
  decorate?: (garden: Garden, sheet: Sheet) => Decorations;
}

/** The foot lies under the stems. */
const FOOT_LAYER = 1.8;
const REST_LAYER = 2.6, VISITOR_LAYER = 6;
/** A hanging garden is cropped this far up its main stems from where they begin, so they enter cut at its top edge. */
const HANGING_ROOT = 0.5;

function motifShapes(item: MotifItem, moment: Moment): Shape[] | null {
  const stage = stageAt(item, moment.t, moment.fullness);
  if (stage === null) return null;
  return item.draw(createRng(item.seed), item.size, stage);
}

const ATTRIBUTE_ENTITIES: Readonly<Record<string, string>> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&apos;" };

/** A motif in place; a mirrored garden draws it as its mirror image, about its axis. */
const group = (at: Pt, angle: number, mirrored: boolean, body: string): string =>
  `<g transform="translate(${num(at[0])} ${num(at[1])}) rotate(${num(angle - 90)})${mirrored ? " scale(-1 1)" : ""}">${body}</g>`;

export function renderGarden(garden: Garden, moment: Moment, options: RenderOptions): string {
  const hanging = options.hanging === true;
  if (hanging && garden.column[2] - garden.column[0] < garden.width) throw new RangeError("a garden grown round a page cannot hang");
  const sheet = new Sheet(options.id);
  const layers = new Map<number, string>();
  const add = (layer: number, body: string): void => { layers.set(layer, (layers.get(layer) ?? "") + body); };
  if (garden.foot) {
    // The foot is drawn for the column and stands where the column does, never mirrored.
    const [x0, , x1] = garden.column;
    const foot = paintShapes(garden.foot.draw(createRng(garden.foot.seed), { width: x1 - x0, height: garden.height }, moment.t, moment.fullness), options.manner, sheet);
    add(FOOT_LAYER, x0 === 0 ? foot : `<g transform="translate(${num(x0)} 0)">${foot}</g>`);
  }
  for (const item of garden.items) {
    if (item.kind === "stem") {
      const shown = stemShown(item, moment.t);
      if (shown <= 0) continue;
      const points = prefix(item.points, shown);
      if (points.length < 2) continue;
      // While it grows, the stem is as thick as its grown length allows and comes to a point.
      const tip = item.w0 + (item.w1 - item.w0) * shown;
      const width = (u: number): number => (item.w0 + (tip - item.w0) * u) * (shown < 1 ? 1 - 0.8 * smoothstep(0.8, 1, u) : 1);
      const shapes: Shape[] = garden.stemInk
        ? garden.stemInk(createRng(Math.imul(garden.seed, 2654435761) + item.order), points, width, item.main)
        : [{ type: "solid", outline: ribbon(points, width) }];
      add(item.layer, paintShapes(shapes, options.manner, sheet));
      continue;
    }
    const shapes = motifShapes(item, moment);
    if (shapes) add(item.layer, group(item.at, item.angle, garden.mirrored, paintShapes(shapes, options.manner, sheet)));
  }
  // Every copy of the guest that has arrived, from one mask: the copies are one figure at one size.
  const arrived = options.guestFigure !== undefined && !hanging ? garden.guests.filter(guest => moment.t >= guest.born) : [];
  const first = arrived[0];
  if (first && options.guestFigure !== undefined) {
    const mask = sheet.id("guest");
    const figure = options.guestFigure.replace(/[&<>"']/gu, character => ATTRIBUTE_ENTITIES[character]!);
    const box = `x="${num(-first.width / 2)}" y="${num(-first.height / 2)}" width="${num(first.width)}" height="${num(first.height)}"`;
    // mask-type as a presentation attribute, not a style: pages with a strict content policy refuse inline styles.
    sheet.defs.push(`<mask id="${mask}" maskUnits="userSpaceOnUse" ${box} mask-type="alpha"><image href="${figure}" ${box} preserveAspectRatio="none"/></mask>`);
    const ink = options.manner === "taille-douce" ? `fill="${inkRef("ink")}"` : `fill="${inkRef("wash")}" fill-opacity="0.85"`;
    // The page is drawn with y up; the engraving is y down, so it is flipped back, and mirrored to face the plant.
    for (const guest of arrived) {
      add(guest.kind === "visitor" ? VISITOR_LAYER : REST_LAYER, `<g transform="translate(${num(guest.at[0])} ${num(guest.at[1])}) rotate(${num(guest.angle)}) scale(${guest.facing} -1)"><rect ${box} ${ink} mask="url(#${mask})"/></g>`);
    }
  }
  const marks = options.decorate?.(garden, sheet) ?? {};
  for (const inlay of marks.inlays ?? []) add(inlay.layer, inlay.svg);

  let body = [...layers.entries()].sort(([a], [b]) => a - b).map(([, text]) => text).join("");
  if (options.manner === "lavis") body = `<g filter="url(#${washFilter(sheet, garden.seed)})">${body}</g>`;
  body = (marks.under ?? "") + body + (marks.over ?? "");
  const w = num(garden.width);
  // The garden is laid out with y up. Standing, it is turned over into the SVG's y down; hanging, it is left
  // as it is, upside down, and the root above where its main stems begin is cropped away.
  const crop = hanging && garden.mains.length > 0 ? Math.min(...garden.mains.map(points => points[0]![1])) + HANGING_ROOT : 0;
  const height = garden.height - crop;
  const drawing = hanging ? body : `<g transform="translate(0 ${num(garden.height)}) scale(1 -1)">${body}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="eglantine" viewBox="0 ${num(crop)} ${w} ${num(height)}" width="${num(garden.width * options.scale)}" height="${num(height * options.scale)}" role="img">`
    + `<defs>${sheet.defs.join("")}</defs>${drawing}</svg>`;
}
