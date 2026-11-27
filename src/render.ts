// A garden at one moment of the day, as one SVG.
import { num, prefix, type Pt, RAD, ribbon, smoothstep } from "./geometry.js";
import { LAYER } from "./form.js";
import { type Garden, type MotifItem, stageAt, stemShown } from "./garden.js";
import { type MannerInput, type MannerModule, type Part, paintShapes, periodManner, Sheet } from "./paint.js";
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
   * Where it lies: the foot is at 1.8, stems at 2, fallen petals at 2.5, a tool at rest at 2.6, leaves at 3, airy
   * motifs at 4, blooms at 5, falling petals at 5.5 and a visiting animal at 6.
   */
  layer: number;
  svg: string;
}

/**
 * Marks a caller lays on the garden. Inlays lie among the plant's parts and take any filter its manner lays over
 * it, such as the lavis wash's bled edge; `under` lies beneath the whole garden and `over` above it, outside it.
 * Paint them with `paintShapes` on the sheet given, so their ids stay unique within the SVG.
 */
export interface Decorations {
  inlays?: readonly Inlay[];
  under?: string;
  over?: string;
}

export interface RenderOptions {
  /** A period manner by its id, or any manner loaded with `loadManner`. The main entry also takes a screen manner's id. */
  manner: MannerInput;
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
   * its leaves fill the guest's room, with no empty shoots left where animals would have stood. Nor does it draw the
   * petals its blooms shed, which would fall upwards. A garden grown
   * round a page cannot hang, since its runner and arcs would turn over onto the text, and nor can a bandeau or a
   * cul-de-lampe, which stand on the band's foot.
   */
  hanging?: boolean;
  /** Extra horizontal room in centimetres on each side of the column so outer leaves never clip at the SVG edge. */
  bleed?: number;
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

/** Shapes carried out of their own frame by `place`, a map of points, with lines and dots widened by `scale`. */
function placeShapes(shapes: readonly Shape[], place: (point: Pt) => Pt, scale: number): Shape[] {
  const carry = (points: readonly Pt[]): Pt[] => points.map(place);
  return shapes.map((shape): Shape => {
    switch (shape.type) {
      case "body": return { ...shape, outline: carry(shape.outline), shadow: shape.shadow.map(carry), grain: shape.grain.map(carry), veins: shape.veins.map(carry) };
      case "solid": return { ...shape, outline: carry(shape.outline) };
      case "line": return { ...shape, points: carry(shape.points), width: shape.width * scale };
      case "dots": return { ...shape, points: carry(shape.points), radius: shape.radius * scale };
    }
  });
}

/** A motif's shapes carried into the page's frame, as `group` would place them, for a manner whose grid is the page's. */
function uprightShapes(shapes: readonly Shape[], at: Pt, angle: number, mirrored: boolean): Shape[] {
  const cos = Math.cos((angle - 90) * RAD), sin = Math.sin((angle - 90) * RAD), flip = mirrored ? -1 : 1;
  return placeShapes(shapes, ([x, y]) => [at[0] + flip * x * cos - y * sin, at[1] + flip * x * sin + y * cos], 1);
}

export function renderGarden(garden: Garden, moment: Moment, options: RenderOptions): string {
  const hanging = options.hanging === true;
  // The manner is resolved once, so every motif is painted from the same style.
  const manner: MannerModule = typeof options.manner === "string" ? periodManner(options.manner) : options.manner;
  const style = manner;
  if (hanging && garden.column[2] - garden.column[0] < garden.width) throw new RangeError("a garden grown round a page cannot hang");
  if (hanging && garden.ornament) throw new RangeError(`a ${garden.ornament} cannot hang`);
  const sheet = new Sheet(options.id);
  const layers = new Map<number, string>();
  const add = (layer: number, body: string): void => { layers.set(layer, (layers.get(layer) ?? "") + body); };
  if (garden.foot) {
    // The foot is drawn for its own column and stands where the garden puts it, never mirrored.
    const { x, width, drop, scale } = garden.foot;
    const drawn = garden.foot.draw(createRng(garden.foot.seed), { width, height: (garden.height + drop) / scale }, moment.t, moment.fullness);
    if (style.upright) {
      add(FOOT_LAYER, paintShapes(placeShapes(drawn, ([px, py]) => [x + scale * px, scale * py - drop], scale), manner, sheet, "foot"));
    } else {
      const foot = paintShapes(drawn, manner, sheet, "foot");
      const transform = `${x === 0 && drop === 0 ? "" : `translate(${num(x)} ${num(-drop)})`}${scale === 1 ? "" : ` scale(${num(scale)})`}`.trim();
      add(FOOT_LAYER, transform ? `<g transform="${transform}">${foot}</g>` : foot);
    }
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
      add(item.layer, paintShapes(shapes, manner, sheet, "stem"));
      continue;
    }
    // A hanging garden's petals would fall upwards, so it lets none fall.
    if (hanging && item.name === "petal") continue;
    const shapes = motifShapes(item, moment);
    if (!shapes) continue;
    const part: Part = item.layer >= LAYER.bloom || item.name === "petal" ? "bloom" : "leaf";
    if (style.upright) add(item.layer, paintShapes(uprightShapes(shapes, item.at, item.angle, garden.mirrored), manner, sheet, part));
    else add(item.layer, group(item.at, item.angle, garden.mirrored, paintShapes(shapes, manner, sheet, part)));
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
    // The page is drawn with y up; the engraving is y down, so it is flipped back, and mirrored to face the plant.
    for (const guest of arrived) {
      add(guest.kind === "visitor" ? VISITOR_LAYER : REST_LAYER, `<g transform="translate(${num(guest.at[0])} ${num(guest.at[1])}) rotate(${num(guest.angle)}) scale(${guest.facing} -1)"><rect ${box} ${style.figure} mask="url(#${mask})"/></g>`);
    }
  }
  const marks = options.decorate?.(garden, sheet) ?? {};
  for (const inlay of marks.inlays ?? []) add(inlay.layer, inlay.svg);

  let body = [...layers.entries()].sort(([a], [b]) => a - b).map(([, text]) => text).join("");
  if (style.filter) body = `<g filter="url(#${style.filter(sheet, garden.seed)})">${body}</g>`;
  body = (marks.under ?? "") + body + (marks.over ?? "");
  const bleed = options.bleed ?? 0;
  if (!(Number.isFinite(bleed) && bleed >= 0)) throw new RangeError(`bleed must be >= 0 (got ${String(options.bleed)})`);
  const viewWidth = garden.width + bleed * 2;
  const w = num(viewWidth);
  // The garden is laid out with y up. Standing, it is turned over into the SVG's y down; hanging, it is left
  // as it is, upside down, and the root above where its main stems begin is cropped away on the foot band only.
  const isFootBand = garden.segment === undefined || garden.segment.index === 0;
  const crop = hanging && isFootBand && garden.mains.length > 0 ? Math.min(...garden.mains.map(points => points[0]![1])) + HANGING_ROOT : 0;
  const height = garden.height - crop;
  const drawing = hanging ? body : `<g transform="translate(0 ${num(garden.height)}) scale(1 -1)">${body}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" class="eglantine" viewBox="${num(-bleed)} ${num(crop)} ${w} ${num(height)}" width="${num(viewWidth * options.scale)}" height="${num(height * options.scale)}" role="img">`
    + `<defs>${sheet.defs.join("")}</defs>${drawing}</svg>`;
}
