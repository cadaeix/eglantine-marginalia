// The garden's growth, after the grown composition of Kevin Raymond's florilegium (MIT; its notice is in
// florilegium-LICENSE.txt beside this file), which follows
// Wong, Zongker & Salesin, "Computer-Generated Floral Ornament" (SIGGRAPH 1998). Main stems sway up
// the column as smooth noise of their height and leaves hang at their nodes; then, repeatedly, the
// largest free hole within reach of a stem gets a motif that fits it, on a branch from the nearest
// stem point. Big holes go first, so blooms land early and leaves fill the gaps.
//
// Given the page beside it, the garden reaches round the text as florilegium's does: a runner leaves
// the root along the page's foot, and where the text ends early, arcs leave the main stems for the room
// under it. A page is laid out as if the column stood left of its text; a right-hand one is that
// layout's mirror image.
//
// The layout is fixed by the seed. Time only reveals it: every item carries the moment of the day
// (0 at its start, 1 at its end) when it appears, and a staged motif buds, opens and goes to seed.
//
// This module loads no plant forms: it grows from a form passed in. grow.ts adds the registered forms by
// their ids, and lite.ts loads them one at a time, so a page can carry only the form it draws.
import { createField, type Rect } from "./field.js";
import type { Festival, FestivalContext, FestivalModule, MainsShaping } from "./festival.js";
import { type Foot, type FormModule, LAYER, type PlantForm, resolveVariant, type Stage, type StemInk, type Variant } from "./form.js";
import { arcLength, bezier3, clamp, degrees, distance, lerp, type Pt, RAD, sample, smoothstep, unit } from "./geometry.js";
import { createRng, fbm1, type Rng } from "./random.js";
import type { Shape } from "./shapes.js";

export interface StemItem {
  kind: "stem";
  order: number;
  layer: number;
  /** A main stem, as against a branch or the root's scroll. */
  main: boolean;
  points: Pt[];
  w0: number;
  w1: number;
  /** The stem lengthens from `born` to `grown`. */
  born: number;
  grown: number;
}
export interface MotifItem {
  kind: "motif";
  order: number;
  layer: number;
  name: string;
  at: Pt;
  /** Direction of the motif's axis, in degrees from +x. */
  angle: number;
  size: number;
  seed: number;
  born: number;
  staged: boolean;
  /** When a staged motif goes to seed. */
  seedAt: number;
  /** For foliage, its place in the order leaves come in as the day fills (0 first); null for blooms. */
  leafRank: number | null;
  draw(rng: Rng, size: number, stage: Stage): Shape[];
}
export type GardenItem = StemItem | MotifItem;

export interface Garden {
  /** The plant form's id. */
  form: string;
  seed: number;
  /** The canvas, in centimetres: the column alone, or the column and the page beside it. */
  width: number;
  height: number;
  /** Where the column stands on the canvas, as [x0, y0, x1, y1]; for a bandeau or cul-de-lampe, the whole band. */
  column: Rect;
  /** The printer's ornament the garden grows as, or null for a margin's column. */
  ornament: Ornament | null;
  /** Laid out for a column right of its text, as the mirror of a left-hand garden: its motifs are drawn mirrored. */
  mirrored: boolean;
  items: GardenItem[];
  /** The main stems' centrelines, for whatever must thread between them. */
  mains: Pt[][];
  /** The head of the tallest bloom: the highest point the garden reaches. */
  crown: Pt;
  /** The day's guest wherever it stands, once for each copy; empty when the day has none. */
  guests: GuestPlace[];
  /**
   * What the plant grows out of, drawn at each moment, if not bare ground: drawn for a column `width` wide, scaled
   * by `scale`, with its left edge at `x` on the canvas and lowered by `drop`. In the column it is drawn as it is;
   * in a band it may be shrunk to fit, and a deep foot runs out under the band's edge.
   */
  foot: { seed: number; draw: Foot["draw"]; x: number; width: number; drop: number; scale: number } | null;
  /** How the stems are inked, if not as plain ribbons. */
  stemInk: StemInk | null;
}

/**
 * A figure the day brings besides the plant. A visitor (an animal) comes into the garden facing the plant: on a
 * shoot that coils out of a main stem for it, as creatures stand on the scrolls of eighteenth-century ornament;
 * among the stems, as a bee flies or a fish swims; or on the ground at the plant's foot. On a shoot or among the
 * stems it comes once for every 12 cm the plant grows in, where there is room for it: once in the 6 × 22 cm column,
 * twice in one 30 cm tall.
 * A figure at rest (a tool) lies near the foot with no one holding it, once.
 */
export interface Guest {
  kind: "visitor" | "rest";
  /** Where a visitor stands; among the stems unless it says otherwise. A figure at rest has none. */
  stance?: GuestStance;
  /** The figure's width over its height. */
  aspect: number;
  /** Its height in centimetres for a visitor, its length for a figure at rest. */
  size: number;
}
/** Where a visitor stands: on a shoot of its own, among the stems, or on the ground. */
export type GuestStance = "shoot" | "stems" | "ground";
export interface GuestPlace {
  kind: Guest["kind"];
  /**
   * Where a visitor stands, which may not be where it asked to: one that finds no room for a shoot comes among the
   * stems instead, though only its first copy does, and a plant without stems leaves only the ground. Null for a
   * figure at rest.
   */
  stance: GuestStance | null;
  /** Centre of the figure. */
  at: Pt;
  width: number;
  height: number;
  /** Tilt in degrees. */
  angle: number;
  /** 1 when the figure faces +x as drawn, -1 when it is mirrored. */
  facing: 1 | -1;
  /** The moment of the day it arrives. */
  born: number;
}

/** The column the forms are drawn for, in centimetres: a margin beside a page of text. */
export const COLUMN = { width: 6, height: 22 } as const;

/**
 * A printer's ornament a garden can grow as, in place of a margin's column. A bandeau is the headpiece over a
 * chapter: there the plant grows as a bed, several short plants side by side along the band's foot. A cul-de-lampe
 * is the tailpiece at a chapter's end: there it sprays out to both sides from one root in the middle.
 */
export type Ornament = "bandeau" | "cul-de-lampe";
/**
 * The room each ornament grows in unless `width` and `height` say otherwise, in centimetres. The plants keep
 * their sizes, as they do in the column, so a smaller band is drawn with a smaller `scale`.
 */
export const ORNAMENTS: Readonly<Record<Ornament, { readonly width: number; readonly height: number }>> = {
  bandeau: { width: 18, height: 6 },
  "cul-de-lampe": { width: 12, height: 8 },
};

/** The text beside the column, which the garden reaches round. */
export interface Page {
  /** Which side of the text the column stands on. */
  side: "left" | "right";
  /** The width of the text, in centimetres. */
  text: number;
  /**
   * The free room under the text's last line, down to the page's foot, in centimetres. With two or more, a
   * runner leaves bare ground along the foot under the text; with about four or more above any foot the plant
   * stands on, arcs leave the main stems for the room under the text.
   */
  below: number;
}

export interface GrowSpec {
  seed: number;
  /**
   * A form passed in, such as one loadForm loads, or, for the main entry's growGarden, a registered form's id
   * (see registry.ts); and the variant that tunes it for one plant.
   */
  form: string | FormModule;
  variant?: Variant;
  /**
   * The column, in centimetres; 6 × 22 by default, or the ornament's room (see ORNAMENTS). The forms are drawn
   * for that column: their sizes are in centimetres and a foot is placed in it, so a much smaller or larger
   * column crowds or empties them.
   */
  width?: number;
  height?: number;
  /** The page beside the column; without it the garden keeps to its column. A bandeau or cul-de-lampe has none. */
  page?: Page;
  /** A printer's ornament to grow as, a bandeau or a cul-de-lampe, in place of the margin's column. */
  ornament?: Ornament;
  guest?: Guest;
  /**
   * One of the festivals of the complementary days, done to the plant (see festival.ts): its stem alone, a
   * quill it twines up, a sheaf, a caricature, a civic crown, or a single seed. The main entry's growGarden takes
   * its id; the light entry takes the module loadFestival loads. A festival garden has no guest.
   */
  festival?: Festival | FestivalModule;
}

/** How far from a stem a hole can be and still be reached by a branch, in centimetres: in the column, and in a band. */
const REACH = 3.0, BAND_REACH = { bandeau: 1.8, "cul-de-lampe": 2.4 } as const;
/** The top of the column stays open sky. */
const SKY = 0.2;
/** A band leaves less of its height as sky: its plants are short, and an ornament is filled nearly to its edge. */
const BAND_SKY = 0.12;
/** Above a band's foot only this share of the band's height shows; the rest of a deep foot lies under the band's edge. */
const BAND_FOOT = { bandeau: 0.3, "cul-de-lampe": 0.45 } as const;
/** The plants of a bed stand about this far apart, in centimetres. */
const BED_SPACING = 3.2;
/** How far past a band's ends a drawing may reach, in centimetres; past its top or its foot, none may. */
const BAND_OVERHANG = 0.3;
/** The stages a staged motif passes through, all probed before a band takes it. */
const STAGES: readonly Stage[] = ["bud", "bloom", "seed"];
/** Petals in the air lie over the blooms; petals on the ground lie over the stems' feet and under the leaves. */
const FALLING = 5.5, FALLEN = 2.5;
const SMALLEST = 0.36;
const FILLMIN = 0.26;
const FILLERS = 12;
const STEM_PHASE = 0.3;
const BUD_SPAN = 0.1;
/** At fullness 0 a garden already shows this share of its leaves, so the plant is never bare. */
const FOLIAGE_FLOOR = 0.3;
/** A visitor arrives at this moment of the day; one on a shoot waits until its shoot has grown. */
const VISIT = 0.2;
/** A visitor's shoot grows over this much of the day, from the moment its main stem reaches the joint. */
const SHOOT_PHASE = 0.07;
/** The radius in centimetres of the volute a visitor's shoot ends in, and its turns. */
const VOLUTE = 0.22, VOLUTE_TURNS = 1.35;
/** A visitor on a shoot or among the stems comes once for every this many centimetres the plant grows in. */
const COPY_HEIGHT = 12;
/**
 * Lattice cells in the column the forms are drawn for. A garden on a page holds more of each motif as its
 * room grows; a column alone keeps its form's counts at any size, as it always has.
 */
const BASE_CELLS = createField([[0.15, 0.3, COLUMN.width - 0.15, COLUMN.height * (1 - SKY)]]).x.length;

interface StemPoint { x: number; y: number; tx: number; ty: number; w: number }
/**
 * A visitor's shoot as it is chosen: the centre of the figure standing on it, the main stem `k` and the point
 * `index` it leaves from, the side it grows to, and its ledge from `x0` to `end` at height `y0`.
 */
interface Shoot { at: Pt; k: number; index: number; side: 1 | -1; x0: number; y0: number; end: number }

/** Grows a garden from a form, and any festival, passed in; the main entry's growGarden (grow.ts) also takes registered ids. */
export function growGarden(spec: GrowSpec & { form: FormModule; festival?: FestivalModule }): Garden {
  return growForm(spec.form.build(resolveVariant(spec.form, spec.variant)), spec.form.id, spec);
}

/** Grows a garden from a built plant form and the id it is known by. */
export function growForm(form: PlantForm, formId: string, spec: GrowSpec): Garden {
  checkOrnament(spec);
  if (spec.festival === undefined) return growPlain(form, formId, spec, null, true);
  const { festival, guest: _guest, ...plain } = spec;
  if (typeof festival === "string") throw new TypeError(`this growGarden holds a festival from its module, as loadFestival("${festival}") gives it`);
  return festival.grow(festivalContext(form, formId, plain));
}

/** Refuses a page the garden cannot lay out round. */
function checkPage(page: Page | null, H: number): void {
  if (page && (!(page.side === "left" || page.side === "right") || !(Number.isFinite(page.text) && page.text > 0) || !(page.below >= 0 && page.below <= H))) {
    throw new RangeError(`A page needs a side, left or right, text wider than 0 cm, and room below the text from 0 to the column's ${H} cm`);
  }
}

/** Refuses an ornament the garden cannot grow as: one it does not know, or one asked to reach round a page. */
function checkOrnament(spec: GrowSpec): void {
  if (spec.ornament === undefined) return;
  if (!Object.hasOwn(ORNAMENTS, spec.ornament)) throw new RangeError(`An ornament is a bandeau or a cul-de-lampe, not ${String(spec.ornament)}`);
  if (spec.page) throw new RangeError("A bandeau or a cul-de-lampe grows on its own, not round a page");
}

/** The garden's room in centimetres: the spec's width and height, or else its ornament's or the column's. */
function roomOf(spec: GrowSpec): { W: number; H: number } {
  const room = spec.ornament ? ORNAMENTS[spec.ornament] : COLUMN;
  return { W: spec.width ?? room.width, H: spec.height ?? room.height };
}

/**
 * The column a plant's foot is drawn for, in centimetres, and whether it is centred in the band: the column's own, a
 * bed's whole band, or in a cul-de-lampe, and for a foot that is the whole plant in either band, a column's width.
 */
function footColumn(form: PlantForm, ornament: Ornament | null, W: number): { width: number; centred: boolean } {
  const centred = ornament === "cul-de-lampe" || (ornament !== null && form.foot !== undefined && form.stems.count === 0);
  return { width: centred ? Math.min(W, COLUMN.width) : W, centred };
}

/**
 * The garden a plant grows without a festival; `shaping`, when given, lays its main stems, and with `shed` its
 * blooms let their petals fall as they go to seed.
 */
function growPlain(form: PlantForm, formId: string, spec: GrowSpec, shaping: MainsShaping | null, shed: boolean): Garden {
  const { W, H } = roomOf(spec);
  const page = spec.page ?? null;
  checkPage(page, H);
  const ornament = spec.ornament ?? null;
  const mirrored = page?.side === "right";
  const canvas = W + (page?.text ?? 0);
  const G = H * (1 - (ornament ? BAND_SKY : SKY));
  const root = createRng(Math.imul(spec.seed, 7919) + 13);
  const layout = root.fork();
  const items: GardenItem[] = [];
  let order = 0;
  const column: Rect = [0.15, 0.3, W - 0.15, G];
  const foot = form.foot ?? null;
  // Where the foot is drawn. In the column it fills the column's width; a right-hand page is drawn as the mirror
  // of this layout, but its foot is drawn as it is, so the room it fills is mirrored here to land under the drawing.
  // A bed's foot runs the band's width. A cul-de-lampe's foot, and in either band a foot that is the whole plant, a
  // single specimen such as a dead birch, is a column's width, `span`, centred in the band. A foot that is the whole
  // plant is shrunk until it fits the band; a cul-de-lampe shrinks a deep foot a little, so more of it shows as the
  // tailpiece's point. What is still too deep is lowered until only its top shows, as a section would be cut by the
  // band's edge.
  const footTop = foot ? Math.max(foot.crown[1], ...foot.room.map(rect => rect[3])) : 0;
  const footScale = !foot || !ornament ? 1
    : form.stems.count === 0 ? Math.min(1, H * 0.9 / footTop)
    : ornament === "cul-de-lampe" ? clamp(H * BAND_FOOT[ornament] / footTop, 0.6, 1) : 1;
  const { width: span, centred } = footColumn(form, ornament, W);
  const footX = foot && centred ? W / 2 - foot.crown[0] * span : 0;
  const drop = foot && ornament && form.stems.count > 0 ? Math.max(0, footTop * footScale - H * BAND_FOOT[ornament]) : 0;
  const footRooms: Rect[] = foot ? foot.room.map(([x0, y0, x1, y1]): Rect => mirrored
    ? [(1 - x1) * W, y0, (1 - x0) * W, y1]
    : [footX + x0 * span, y0 * footScale - drop, footX + x1 * span, y1 * footScale - drop]) : [];
  // A foot that spans the column, such as a bed of strata, is the ground the guest stands or lies on, and fallen petals lie on.
  const floor = foot ? Math.max(0, ...foot.room.flatMap((rect, index) => rect[2] - rect[0] > 0.5 ? [footRooms[index]![3]] : [])) : 0;
  // The page draws from a stream of its own, so the runner's length, chosen here, never moves the main stems.
  const spread = createRng(Math.imul(spec.seed, 7919) + 409);
  let ground: Rect | null = null, room: Rect | null = null;
  if (page) {
    // A foot is its own ground, standing in the column: only bare ground sends a runner under the text, along
    // a band no lower than its leaflets need, and beside a foot the room under the text begins at the foot's
    // top, since below that it lies underground.
    if (!foot && page.below >= 2) ground = [W - 0.16, 0.3, W + page.text * spread.range(0.42, 0.52), Math.min(1.75, page.below - 0.45)];
    const base = foot ? Math.max(...footRooms.map(rect => rect[3])) + 0.1 : 0.3;
    // Sprays and blooms reach past their room's edge, so the room stops well short of the last line.
    if (page.below - 1.2 - base > 2.5) room = [W - 0.16, base, W + page.text - 0.6, page.below - 1.2];
  }
  const field = createField([column, ...(ground ? [ground] : []), ...(room ? [room] : [])]);
  // A garden on a page or in a band holds more of each motif as its room grows.
  const plenty = page || ornament ? Math.max(1, field.x.length / BASE_CELLS) : 1;
  const reach = ornament ? BAND_REACH[ornament] : REACH;
  // A cul-de-lampe tapers to its root, as the tailpiece's inverted triangle does: at height `y` it keeps open only
  // `taper(y)` either side of its middle. Its lower corners are closed in steps, so that only the arching stems cross
  // them, and the petals it sheds gather round its foot.
  const taper = (y: number): number => lerp(1.2, W / 2, clamp(y / (H * 0.55), 0, 1));
  if (ornament === "cul-de-lampe") {
    for (let y = 0; y < H * 0.55; y += 0.4) {
      const open = W / 2 - taper(y + 0.2);
      if (open < 0.15) continue;
      field.block([0, y, open, y + 0.4]);
      field.block([W - open, y, W, y + 0.4]);
    }
  }
  const nearestStemDistance = new Float64Array(field.x.length).fill(Infinity);
  const stemPoints: StemPoint[] = [];

  const addStemPoints = (points: Pt[], w0: number, w1: number, every = 1): void => {
    for (let index = 0; index < points.length; index += every) {
      const a = points[Math.max(0, index - 1)]!, b = points[Math.min(points.length - 1, index + 1)]!;
      const [tx, ty] = unit(b[0] - a[0], b[1] - a[1]);
      const p = points[index]!;
      stemPoints.push({ x: p[0], y: p[1], tx, ty, w: lerp(w0, w1, index / Math.max(1, points.length - 1)) });
      field.eachNear(p[0], p[1], reach, cell => {
        const d = Math.hypot(field.x[cell]! - p[0], field.y[cell]! - p[1]);
        if (d < nearestStemDistance[cell]!) nearestStemDistance[cell] = d;
      });
    }
  };
  const nearestStem = (x: number, y: number): StemPoint => {
    let best = Infinity, found = stemPoints[0]!;
    for (const point of stemPoints) {
      const d = Math.hypot(point.x - x, point.y - y);
      if (d < best) { best = d; found = point; }
    }
    return found;
  };
  const stem = (points: Pt[], w0: number, w1: number, born: number, grown: number, proxy = 0.1, main = false): StemItem => {
    const item: StemItem = { kind: "stem", order: order++, layer: LAYER.stem, main, points, w0, w1, born, grown };
    items.push(item);
    for (let index = 0; index < points.length; index += 2) field.disc(points[index]![0], points[index]![1], proxy, 1);
    return item;
  };
  /** A seed for a motif's own random stream, drawn from the layout's as the motif is placed, or before, for a band to probe it. */
  const motifSeed = (): number => Math.floor(layout.u() * 4294967295);
  const motif = (name: string, at: Pt, angle: number, size: number, layer: number, born: number, staged: boolean,
    draw: MotifItem["draw"], seed = motifSeed()): MotifItem => {
    const item: MotifItem = { kind: "motif", order: order++, layer, name, at, angle, size, seed, born, staged, seedAt: 2, leafRank: null, draw };
    items.push(item);
    return item;
  };
  /** The blooms that shed their petals as they go to seed, each with what draws one of them. */
  const shedders: { bloom: MotifItem; from: { petal?(rng: Rng, s: number): Shape[] } }[] = [];

  /**
   * Whether a motif drawn at `at` along `angle` would run out of a band, such as an amaranth's tassel hanging past
   * its foot: its drawing is probed at every stage it passes through, so nothing it becomes later runs out either.
   */
  const runsOut = (draw: MotifItem["draw"], size: number, at: Pt, angle: number, staged: boolean, seed: number): boolean =>
    (staged ? STAGES : ["bloom" as const]).some(stage => {
      const [left, below, right, above] = reachOf(draw(createRng(seed), size, stage), angle);
      return at[1] + below < 0 || at[1] + above > H || at[0] + left < -BAND_OVERHANG || at[0] + right > W + BAND_OVERHANG;
    });

  // ---------------------------------------------------------------- 1. the foot, then the main stems out of it
  for (const rect of footRooms) field.block(rect);
  const crownX = foot ? (mirrored ? W * (1 - foot.crown[0]) : footX + foot.crown[0] * span) : null;
  const mains: Pt[][] = [];
  const mainItems: StemItem[] = [];
  /** Whether each main stem leads its plant: the thickest, under the largest bloom. */
  const leads: boolean[] = [];
  /** Where the plants stand: the column's one, a bed's several, a cul-de-lampe's one in the middle. */
  let roots: Pt[];
  /** In a band, the largest bloom that fits under the band's top, and how far beyond its stem's tip it reaches. */
  const bloom = Math.min(form.terminal.size[1], G * 0.32);
  const bloomReach = form.terminal.r(bloom) * 1.5;
  if (!ornament) {
    const rootAt: Pt = crownX !== null ? [crownX, foot!.crown[1]] : [W * layout.range(0.22, 0.3), 0.75];
    roots = [rootAt];
    const centre = W * 0.47, amplitude = W * form.stems.amplitude * 2.2;
    const tops = form.stems.tops.map((top, index) => G * (index === 0 ? top : top * layout.range(0.92, 1.06)));
    for (let k = 0; k < form.stems.count; k += 1) {
      const sway = fbm1(layout, 2);
      const phase = layout.range(0, 10), lambda = layout.range(...form.stems.lambda);
      const x0 = rootAt[0] + (k - 1) * 0.2;
      // A festival may lay the stem itself, from the stem the loop lays; the sway's draws are made all the same, so
      // the rest of the layout draws as it would.
      const points: Pt[] = [];
      for (let y = rootAt[1]; y <= tops[k]!; y += 0.25) {
        let x = centre + amplitude * sway(y / lambda + phase) + (k - 1) * 0.4;
        x = lerp(x0, x, smoothstep(0, 4, y - rootAt[1]));
        points.push([clamp(x, 0.8, W - 0.8), y]);
      }
      mains.push(shaping ? shaping(k, rootAt, tops[k]!, points) : points);
      leads.push(k === 0);
    }
  } else {
    const ground = foot ? foot.crown[1] * footScale - drop : 0.5;
    const top = G - bloomReach;
    const band = ornament === "bandeau"
      ? bedStems(layout, form, W, ground, top, crownX, shaping)
      : sprayStems(layout, form, W, [crownX ?? W / 2 + layout.sym(0.12), ground], top, bloomReach, shaping);
    mains.push(...band.mains);
    leads.push(...band.leads);
    roots = band.roots;
  }
  /** The root the foot's crown holds, or the first plant's. */
  const rootAt: Pt = roots.find(at => at[0] === crownX) ?? roots[0] ?? [W / 2, 0.5];
  const longest = Math.max(...mains.map(points => arcLength(points).total));
  mains.forEach((points, k) => {
    const w0 = form.stems.width * (leads[k] ? 1 : 0.8);
    const grown = STEM_PHASE * arcLength(points).total / longest;
    mainItems.push(stem(points, w0, Math.max(0.025, form.stems.width * 0.3), 0, grown, 0.1, true));
    addStemPoints(points, w0, 0.028);
  });
  // On bare ground the root curls into a scroll at the corner. A bed's outer plants curl theirs outwards, as the
  // brackets at a headpiece's ends, and a cul-de-lampe's root curls to both sides of it.
  if (!foot || foot.scroll) {
    const first = roots[0], last = roots[roots.length - 1];
    const curls: [Pt, 1 | -1][] = ornament === null ? [[rootAt, -1]]
      : ornament === "cul-de-lampe" ? [[rootAt, -1], [rootAt, 1]]
      : first && last ? [[first, -1], [last, 1]] : [];
    for (const [at, side] of curls) {
      const turns = layout.range(1.2, 1.6);
      const scroll = sample(t => {
        const a = Math.PI * 0.5 + t * turns * 2 * Math.PI;
        const r = 0.5 * (1 - 0.85 * t) ** 1.3;
        // Written out for each side, so the column's scroll keeps its arithmetic to the last bit, and its garden with it.
        return [side < 0 ? at[0] - 0.5 - r * Math.cos(a) : at[0] + 0.5 + r * Math.cos(a), at[1] + 0.05 + r * Math.sin(a)];
      }, 40);
      stem(scroll, form.stems.width * 0.7, 0.012, 0, 0.06);
    }
  }

  // ---------------------------------------------------------------- 2. terminal blooms
  // A foot with no stems above it is the whole garden, and its top is the highest point.
  let crown: Pt = foot && form.stems.count === 0 ? [rootAt[0], Math.max(rootAt[1], ...footRooms.map(rect => rect[3]))] : [W / 2, 0];
  mains.forEach((points, k) => {
    const tip = points[points.length - 1]!, before = points[Math.max(0, points.length - 3)]!;
    const [hx, hy] = unit(tip[0] - before[0], tip[1] - before[1]);
    // The column's first bloom is the largest its width suits, and stands upright; in a band each bloom follows its
    // stem, and none outgrows the band.
    let size = ornament ? Math.min(bloom, layout.range(...form.terminal.size) * (leads[k] ? 1 : 0.85))
      : k === 0 ? Math.min(form.terminal.size[1], W * 0.27) : layout.range(...form.terminal.size) * 0.85;
    const at: Pt = [tip[0] + hx * 0.05, tip[1] + hy * 0.05];
    const angle = !ornament && k === 0 ? 90 : degrees(hx, hy);
    const seed = ornament ? motifSeed() : undefined;
    if (seed !== undefined) for (let attempt = 0; attempt < 4 && runsOut(form.terminal.draw, size, at, angle, true, seed); attempt += 1) size *= 0.85;
    const bloomItem = motif("terminal", at, angle, size, LAYER.bloom, mainItems[k]!.grown, true, form.terminal.draw, seed);
    if (form.terminal.petal) shedders.push({ bloom: bloomItem, from: form.terminal });
    const r = form.terminal.r(size);
    field.disc(at[0] + hx * r * 0.6, at[1] + hy * r * 0.6, r * 1.1, 0.85);
    if (at[1] + r * 1.4 > crown[1]) crown = [at[0], Math.min(H, at[1] + r * 1.4)];
  });

  // ---------------------------------------------------------------- 2b. the day's guest, before the leaves, so they grow around it
  let guests: GuestPlace[] = [];
  if (spec.guest) {
    // Its own stream: the guest's choices never move the rest of the layout's draws.
    const visit = createRng(Math.imul(spec.seed, 7919) + 101);
    const { kind, aspect, size } = spec.guest;
    // A plant without stems leaves a visitor only the ground to stand on.
    const stance: GuestStance | null = kind === "rest" ? null : mains.length === 0 ? "ground" : spec.guest.stance ?? "stems";
    const wantedWidth = kind === "visitor" ? size * aspect : size, wantedHeight = kind === "visitor" ? size : size / aspect;
    const tilt = kind === "rest" ? 7 : 4;
    const fitAngle = Math.min(tilt * RAD, Math.atan2(wantedHeight, wantedWidth));
    const span = wantedWidth * Math.cos(fitAngle) + wantedHeight * Math.sin(fitAngle);
    // A figure is fitted to the column's width; in a band, where a tall one such as the incubator would fill the
    // band, it is fitted to the band's height as well.
    const rise = wantedWidth * Math.sin(fitAngle) + wantedHeight * Math.cos(fitAngle);
    const fit = Math.min(1, (W - 0.3) / span, ornament ? G * 0.6 / rise : 1);
    const width = wantedWidth * fit, height = wantedHeight * fit, halfSpan = span * fit / 2;
    const reach = Math.max(width, height) * 0.5;
    const copies = stance === "shoot" || stance === "stems" ? Math.max(1, Math.floor(G / COPY_HEIGHT)) : 1;
    /**
     * The roomiest of `attempts` places that `candidate` offers, by the free room around the figure. A candidate
     * may offer none, and no copy stands within its own height and a centimetre of another.
     */
    const roomiest = <T extends { at: Pt }>(attempts: number, candidate: () => T | null): T | null => {
      let found: T | null = null, best = -Infinity;
      for (let attempt = 0; attempt < attempts; attempt += 1) {
        const offer = candidate();
        if (!offer || guests.some(other => Math.abs(other.at[1] - offer.at[1]) < height + 1)) continue;
        const [x, y] = offer.at;
        const room = Math.min(field.freeAt(x, y), field.freeAt(x - width * 0.35, y), field.freeAt(x + width * 0.35, y));
        if (room > best) { best = room; found = offer; }
      }
      return found;
    };
    /** The side the copy below grew its shoot to, so that the next grows across from it. */
    let below: 1 | -1 | null = null;
    for (let copy = 0; copy < copies; copy += 1) {
      // Each copy keeps to its own band of the stems, the first lowest.
      const band = (low: number, high: number): number => visit.range(low + (high - low) * copy / copies, low + (high - low) * (copy + 1) / copies);
      let place: GuestPlace | null = null;
      if (stance === "shoot") {
        // The shoot leaves a main stem, flattens into a ledge as long as the figure, and curls into a volute at its
        // end. It grows to either side where it fits in the column, or across from the copy below if it fits there.
        const shootAt = (preferred: 1 | -1 | null): Shoot | null => {
          const k = visit.int(0, mains.length - 1), index = Math.floor((mains[k]!.length - 1) * band(0.2, 0.75));
          const p = mains[k]![index]!;
          const side = preferred ?? (visit.chance(0.5) ? 1 : -1);
          const x0 = p[0] + side * 0.3, y0 = p[1] + visit.range(0.35, 0.6), end = x0 + side * (width + 0.2);
          const outer = end + side * (VOLUTE + 0.08);
          // In a band, a shoot so high that the figure on it would stand out of the band is no place for it.
          if (outer < 0.15 || outer > W - 0.15 || y0 + height > H - 0.15) return null;
          return { at: [(x0 + end) / 2, y0 + height / 2 + 0.03], k, index, side, x0, y0, end };
        };
        const across: 1 | -1 | null = below === null ? null : below === 1 ? -1 : 1;
        const shoot: Shoot | null = (across === null ? null : roomiest(40, () => shootAt(across))) ?? roomiest(40, () => shootAt(null));
        if (shoot) {
          const { k, index, side, x0, y0, end }: Shoot = shoot;
          const p = mains[k]![index]!;
          const rise = sample(bezier3(p, [p[0] + side * 0.05, lerp(p[1], y0, 0.8)], [x0 - side * 0.2, y0], [x0, y0]), 10);
          const ledge = sample((v): Pt => [lerp(x0, end, v), y0 + 0.05 * Math.sin(Math.PI * v)], 10);
          const curl = sample((v): Pt => {
            const a = Math.PI / 2 - side * v * VOLUTE_TURNS * 2 * Math.PI, r = VOLUTE * (1 - 0.82 * v) ** 1.3;
            return [end + r * Math.cos(a), y0 - VOLUTE + r * Math.sin(a)];
          }, 32);
          // The shoot starts once the main stem, which grows by length, has reached the joint.
          const along = arcLength(mains[k]!);
          const born = along.at[index]! / along.total * mainItems[k]!.grown;
          stem([...rise, ...ledge.slice(1), ...curl.slice(1)], form.stems.width * 0.75, 0.015, born, born + SHOOT_PHASE);
          place = { kind, stance: "shoot", at: shoot.at, width, height, angle: 0, facing: side > 0 ? -1 : 1, born: Math.max(VISIT, born + SHOOT_PHASE) };
          below = side;
        }
      }
      // A visitor that finds no shoot comes among the stems, but only once: a later copy without a shoot stays away.
      if (!place && (stance === "stems" || (stance === "shoot" && copy === 0))) {
        // Beside a main stem, a quarter to two thirds of the way up, facing it.
        const found = roomiest(40, () => {
          const points = visit.pick(mains);
          const p = points[Math.floor(points.length * band(0.25, 0.7))]!;
          const side = visit.chance(0.5) ? 1 : -1;
          const at: Pt = [clamp(p[0] + side * (width / 2 + 0.12), halfSpan + 0.15, W - halfSpan - 0.15), p[1] + height * 0.15];
          const facing: 1 | -1 = at[0] === p[0] ? (side > 0 ? -1 : 1) : at[0] > p[0] ? -1 : 1;
          const angle = visit.sym(tilt);
          return at[1] + height / 2 > H - 0.1 ? null : { at, facing, angle };
        });
        if (found) place = { kind, stance: "stems", ...found, width, height, born: VISIT };
      }
      if (!place && stance === "ground") {
        // On the ground, facing the foot of the nearest main stem.
        const feet = mains.map(points => points[0]![0]);
        const found = roomiest(40, () => {
          const x = clamp(visit.range(width / 2 + 0.3, W - width / 2 - 0.3), halfSpan + 0.15, W - halfSpan - 0.15);
          const nearest = feet.reduce<number | null>((best, f) => best === null || Math.abs(f - x) < Math.abs(best - x) ? f : best, null);
          const facing: 1 | -1 = nearest === null ? (visit.chance(0.5) ? 1 : -1) : x > nearest ? -1 : 1;
          const at: Pt = [x, floor + height / 2 + 0.05];
          return { at, facing, angle: 0 };
        });
        if (found) place = { kind, stance: "ground", ...found, width, height, born: VISIT };
      }
      if (!place && kind === "rest") {
        // Near the foot, among the stems, from the start of the day.
        const found = roomiest(40, () => {
          const at: Pt = [clamp(visit.range(width / 2 + 0.3, W - width / 2 - 0.3), halfSpan + 0.15, W - halfSpan - 0.15), floor + visit.range(height / 2 + 0.45, 2.2)];
          const facing: 1 | -1 = visit.chance(0.5) ? 1 : -1;
          return { at, facing, angle: visit.sym(tilt) };
        });
        if (found) place = { kind, stance: null, ...found, width, height, born: 0 };
      }
      // A copy with no room apart from the others stays away, and so do any above it.
      if (!place) break;
      guests.push(place);
      for (const f of [-0.3, 0, 0.3]) field.disc(place.at[0] + place.width * f, place.at[1], Math.max(place.height * 0.6, reach * 0.55), 1);
    }
  }

  // ---------------------------------------------------------------- 2c. the page: a runner along its foot, arcs into the room under the text
  let runner: StemItem | null = null;
  if (ground) {
    const wave = fbm1(spread, 2);
    const level = (ground[1] + ground[3]) / 2 - 0.05;
    const points: Pt[] = [];
    for (let x = rootAt[0]; x <= ground[2] - 0.3; x += 0.2) {
      points.push([x, lerp(rootAt[1] + 0.1, level + 0.22 * wave(x / 3.5), smoothstep(rootAt[0], rootAt[0] + 1.5, x))]);
    }
    const w0 = form.stems.width * 0.7;
    // A slim proxy, as florilegium's footer has, leaves its narrow band room for leaflets.
    runner = stem(points, w0, 0.012, 0, Math.min(STEM_PHASE, STEM_PHASE * arcLength(points).total / longest), 0.06);
    addStemPoints(points, w0, 0.012);
  }
  const arcs: StemItem[] = [];
  if (room && mains.length > 0) {
    // Arcs leave the stems a little above the room's foot, so beside a foot they never cross its drawing.
    const floor = room[1] + 0.4;
    const tall = room[3] - floor;
    const count = Math.max(1, Math.floor(tall / 7));
    for (let b = 0; b < count; b += 1) {
      const y0 = floor + tall * (b + 0.25) / count;
      const k = spread.int(0, mains.length - 1);
      const source = mains[k]!;
      let from = 0;
      for (let index = 1; index < source.length; index += 1) if (Math.abs(source[index]![1] - y0) < Math.abs(source[from]![1] - y0)) from = index;
      const start = source[from]!, reach = room[2] - start[0];
      const end: Pt = [start[0] + reach * spread.range(0.7, 0.88), Math.max(floor, Math.min(room[3] - 1.4, y0 + tall / count * spread.range(0.35, 0.6)))];
      const wave = fbm1(spread, 2);
      const curve = sample(bezier3(start, [start[0] + reach * 0.25, start[1] + spread.range(-0.4, 0.8)],
        [end[0] - reach * 0.3, end[1] + spread.range(-1.2, -0.3)], end), Math.max(8, Math.floor(reach / 0.2)));
      const points = curve.map(([x, y], index): Pt =>
        [x, clamp(y + 0.35 * wave(x / 3) * Math.sin(Math.PI * index / (curve.length - 1)), floor - 0.3, room[3] - 0.3)]);
      const { at: lengths, total } = arcLength(source);
      const born = lerp(mainItems[k]!.born, mainItems[k]!.grown, lengths[from]! / total);
      const w0 = form.stems.width * 0.6;
      const arc = stem(points, w0, 0.025, born, Math.max(born + 0.02, Math.min(STEM_PHASE, born + STEM_PHASE * arcLength(points).total / longest)));
      addStemPoints(points, w0, 0.025);
      arcs.push(arc);
      // Each arc ends in the plant's bloom.
      const tip = points[points.length - 1]!, before = points[points.length - 3]!;
      const [hx, hy] = unit(tip[0] - before[0], tip[1] - before[1]);
      const size = spread.range(...form.terminal.size) * 0.85;
      const at: Pt = [tip[0] + hx * 0.05, tip[1] + hy * 0.05];
      const bloomItem = motif("terminal", at, degrees(hx, hy), size, LAYER.bloom, arc.grown, true, form.terminal.draw);
      if (form.terminal.petal) shedders.push({ bloom: bloomItem, from: form.terminal });
      const r = form.terminal.r(size);
      field.disc(at[0] + hx * r * 0.6, at[1] + hy * r * 0.6, r * 1.1, 0.85);
      if (at[1] + r * 1.4 > crown[1]) crown = [at[0], Math.min(H, at[1] + r * 1.4)];
    }
  }

  // ---------------------------------------------------------------- 3. leaves: a basal rosette, then the nodes
  if (form.basal) {
    const basal = form.basal;
    // In a band each plant has its rosette, a bed's sparer than a column's, and none outgrows the band.
    const scale = ornament ? Math.min(1, (G - rootAt[1]) * 0.55 / basal.length[1]) : 1;
    for (const at of roots) {
      const drawn = layout.int(...basal.count);
      const count = ornament === "bandeau" ? Math.max(2, Math.round(drawn * 0.6)) : drawn;
      for (let k = 0; k < count; k += 1) {
        const spread = (k / Math.max(1, count - 1)) * 2 - 1;
        const angle = 90 + spread * 48 + layout.sym(6);
        const length = layout.range(...basal.length) * (1 - 0.35 * Math.abs(spread)) * scale;
        const base: Pt = [at[0] + spread * 0.25, at[1] - 0.05];
        const bend = -spread * layout.range(0.08, 0.2);
        motif("basal", base, angle, length, LAYER.leaf, 0.01 + 0.08 * (k / count), false, (rng, size) => form.leaf(rng, size, bend));
        for (const f of [0.3, 0.55, 0.8]) field.disc(base[0] + Math.cos(angle * RAD) * length * f, base[1] + Math.sin(angle * RAD) * length * f, 0.12 * length, 0.85);
      }
    }
  }
  const leafProxy = form.leafProxy;
  /** Hangs leaves at a stem's nodes, alternating sides, wherever they fit. */
  const hangLeaves = (points: Pt[], item: StemItem): void => {
    const { at: lengths, total } = arcLength(points);
    let next = layout.range(0.8, 1.4), sideOf = layout.chance(0.5) ? 1 : -1;
    for (let index = 2; index < points.length - 4; index += 1) {
      if (lengths[index]! < next) continue;
      next += layout.range(...form.nodes.every);
      sideOf = -sideOf;
      const p = points[index]!;
      if (p[1] / G > form.nodes.below) continue;
      const [tx, ty] = unit(points[index + 1]![0] - points[index - 1]![0], points[index + 1]![1] - points[index - 1]![1]);
      const angle = degrees(tx, ty) + sideOf * layout.range(...form.nodes.angle);
      const ux = Math.cos(angle * RAD), uy = Math.sin(angle * RAD);
      let length = form.nodes.length(p[1] / G) * layout.range(0.85, 1.1);
      // In a band the leaf must also keep inside it, so its bend and seed are drawn first to probe it.
      const early = ornament ? { bend: sideOf * layout.range(0.05, 0.25), seed: motifSeed() } : null;
      let fits = false;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (field.freeAt(p[0] + ux * length * 0.55, p[1] + uy * length * 0.55) >= leafProxy * length
          && !(early && runsOut((rng, size) => form.leaf(rng, size, early.bend), length, p, angle, false, early.seed))) { fits = true; break; }
        length *= 0.75;
      }
      if (!fits || length < 0.6) continue;
      const bend = early ? early.bend : sideOf * layout.range(0.05, 0.25);
      const born = lerp(item.born, item.grown, lengths[index]! / total) + 0.005;
      motif("leaf", p, angle, length, LAYER.leaf, born, false, (rng, size) => form.leaf(rng, size, bend), early?.seed);
      for (const f of [0.3, 0.55, 0.8]) field.disc(p[0] + ux * length * f, p[1] + uy * length * f, leafProxy * length, 0.85);
    }
  };
  mains.forEach((points, k) => hangLeaves(points, mainItems[k]!));
  for (const arc of arcs) hangLeaves(arc.points, arc);
  // The runner bears leaflets, thinning out towards its end.
  if (runner) {
    const { points } = runner;
    const { at: lengths, total } = arcLength(points);
    let next = layout.range(0.6, 1.3), sideOf = layout.chance(0.5) ? 1 : -1;
    for (let index = 1; index < points.length - 4; index += 1) {
      if (lengths[index]! < next) continue;
      const u = lengths[index]! / total;
      next += lerp(0.55, 1.4, u) * layout.range(0.8, 1.2);
      sideOf = -sideOf;
      const p = points[index]!;
      const [tx, ty] = unit(points[index + 1]![0] - points[index - 1]![0], points[index + 1]![1] - points[index - 1]![1]);
      const angle = degrees(tx, ty) + sideOf * layout.range(35, 60);
      const ux = Math.cos(angle * RAD), uy = Math.sin(angle * RAD);
      let length = lerp(0.95, 0.45, u) * layout.range(0.85, 1.1);
      let fits = false;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (field.freeAt(p[0] + ux * length * 0.55, p[1] + uy * length * 0.55) >= 0.24 * length) { fits = true; break; }
        length *= 0.75;
      }
      if (!fits || length < 0.3) continue;
      const bend = -sideOf * layout.range(0.1, 0.3);
      motif("leaflet", p, angle, length, LAYER.leaf, lerp(runner.born, runner.grown, u) + 0.005, false, (rng, size) => form.leaflet(rng, size, bend));
      for (const f of [0.3, 0.55, 0.8]) field.disc(p[0] + ux * length * f, p[1] + uy * length * f, 0.24 * length, 0.85);
    }
  }

  // ---------------------------------------------------------------- 4. branches to the largest holes
  const counts = new Map(form.motifs.map(row => [row.name, 0]));
  const caps = new Map(form.motifs.map(row => [row.name, Math.round(row.max * plenty)]));
  const branchItems: { stem: StemItem | null; leaves: MotifItem[]; motif: MotifItem }[] = [];
  for (let round = 0; round < 300 * plenty; round += 1) {
    let best = -1, cell = -1;
    for (let index = 0; index < field.x.length; index += 1) {
      if (nearestStemDistance[index]! > reach) continue;
      const value = field.free[index]! * layout.range(0.85, 1.15);
      if (value > best) { best = value; cell = index; }
    }
    if (cell < 0 || field.free[cell]! < SMALLEST) break;
    const free = field.free[cell]!, px = field.x[cell]!, py = field.y[cell]!;
    const eligible = form.motifs.filter(row => row.r(row.smin) <= free * 1.05 && (!row.hard || counts.get(row.name)! < caps.get(row.name)!));
    if (eligible.length === 0) { field.free[cell] = 0; continue; }
    const weights = eligible.map(row => row.w / (1 + counts.get(row.name)! / Math.max(1, caps.get(row.name)!)));
    let pick = eligible[eligible.length - 1]!, roll = layout.u() * weights.reduce((sum, w) => sum + w, 0);
    for (const [index, row] of eligible.entries()) { roll -= weights[index]!; if (roll <= 0) { pick = row; break; } }
    let size = pick.smax;
    if (pick.r(size) > free * 0.95) {
      let low = pick.smin, high = size;
      for (let step = 0; step < 20; step += 1) { const mid = (low + high) / 2; if (pick.r(mid) > free * 0.95) high = mid; else low = mid; }
      size = low;
    }
    const from = nearestStem(px, py);
    const [dx, dy] = unit(px - from.x, py - from.y);
    const [ax, ay] = unit(dx, dy + (pick.upright ?? 0));
    const origin: Pt = [px - ax * pick.off(size), py - ay * pick.off(size)];
    // A motif that would run out of a band is not placed there, and its hole is given up.
    const seed = ornament ? motifSeed() : undefined;
    if (seed !== undefined && runsOut(pick.draw, size, origin, degrees(ax, ay), pick.staged ?? false, seed)) { field.free[cell] = 0; continue; }
    let branch: StemItem | null = null;
    const leaves: MotifItem[] = [];
    if (distance(origin, [from.x, from.y]) > 0.12) {
      const path = branchPath(layout, from, origin, [ax, ay]);
      const w = Math.min(from.w * 0.7, 0.045);
      branch = stem(path, w, Math.max(0.012, w * 0.45), 0, 0, 0.07);
      addStemPoints(path, w, Math.max(0.012, w * 0.45), 2);
      const reach = distance(origin, [from.x, from.y]);
      if (reach > 1.5) {
        const count = reach > 2.5 ? 2 : 1;
        for (let j = 1; j <= count; j += 1) {
          const index = Math.floor(path.length * (0.25 + 0.3 * j / count));
          const p = path[index]!, q = path[Math.min(path.length - 1, index + 1)]!;
          const angle = degrees(q[0] - p[0], q[1] - p[1]) + (j % 2 === 0 ? 1 : -1) * layout.range(40, 60);
          const length = layout.range(0.5, 0.8);
          const bend = layout.sym(0.2);
          const draw: MotifItem["draw"] = (rng, s) => form.leaflet(rng, s, bend);
          // In a band a leaflet that would run out of it is left off the branch.
          const leafletSeed = ornament ? motifSeed() : undefined;
          if (leafletSeed !== undefined && runsOut(draw, length, p, angle, false, leafletSeed)) continue;
          leaves.push(motif("leaflet", p, angle, length, LAYER.leaf, 0, false, draw, leafletSeed));
          field.disc(p[0] + Math.cos(angle * RAD) * length * 0.5, p[1] + Math.sin(angle * RAD) * length * 0.5, 0.25 * length, 0.7);
        }
      }
    }
    const placed = motif(pick.name, origin, degrees(ax, ay), size, pick.layer, 0, pick.staged ?? false, pick.draw, seed);
    if (pick.petal && pick.staged) shedders.push({ bloom: placed, from: pick });
    branchItems.push({ stem: branch, leaves, motif: placed });
    counts.set(pick.name, counts.get(pick.name)! + 1);
    field.disc(px, py, pick.r(size), 0.85);
  }
  // Big holes first, slowly; the last branches come quickly.
  branchItems.forEach((branch, index) => {
    const born = 0.28 + 0.55 * (index / Math.max(1, branchItems.length - 1)) ** 0.75;
    if (branch.stem) { branch.stem.born = born; branch.stem.grown = born + 0.03; }
    for (const leaf of branch.leaves) leaf.born = born + 0.02;
    branch.motif.born = born + (branch.stem ? 0.03 : 0);
  });

  // ---------------------------------------------------------------- 5. filler: small leaves tucked in near the stems
  const fillers: MotifItem[] = [];
  for (let round = 0; round < FILLERS * plenty; round += 1) {
    let best = -1, cell = -1;
    for (let index = 0; index < field.x.length; index += 1) {
      if (nearestStemDistance[index]! > 0.75) continue;
      if (field.free[index]! > best) { best = field.free[index]!; cell = index; }
    }
    if (cell < 0 || best < FILLMIN) break;
    const px = field.x[cell]!, py = field.y[cell]!;
    const from = nearestStem(px, py);
    const [dx, dy] = unit(px - from.x, py - from.y);
    const length = clamp(best * 2.2, 0.35, 0.8);
    const bend = layout.sym(0.2);
    const draw: MotifItem["draw"] = (rng, s) => form.leaflet(rng, s, bend);
    const seed = ornament ? motifSeed() : undefined;
    if (seed !== undefined && runsOut(draw, length, [from.x, from.y], degrees(dx, dy + 0.3), false, seed)) { field.free[cell] = 0; continue; }
    fillers.push(motif("filler", [from.x, from.y], degrees(dx, dy + 0.3), length, LAYER.leaf, 0, false, draw, seed));
    field.disc(px, py, best, 0.9);
  }
  fillers.forEach((item, index) => { item.born = 0.84 + 0.1 * index / Math.max(1, fillers.length); });

  ripen(items, spec.seed);

  // ---------------------------------------------------------------- 6. petals, shed as the blooms go to seed
  // A bloom that sheds lets a few petals fall as it goes to seed: some hang in the air below it, further aside the
  // further they have fallen, and the rest lie on the ground. Each bloom's petals come from a stream of their own,
  // after the rest of the layout, so the garden's other parts grow as they would without them; and like everything
  // else a petal stays where it appears, so a moment still only reveals. On a page, a petal beside the text keeps to
  // the column.
  if (shed) {
    const lying = foot ? floor + 0.08 : rootAt[1] - (ornament ? 0.25 : 0.4);
    for (const { bloom, from } of shedders) {
      const fall = createRng(Math.imul(bloom.seed, 2654435761) + 977);
      const drop = Math.max(0, bloom.at[1] - lying);
      const draw: MotifItem["draw"] = (rng, s) => from.petal!(rng, s);
      for (let j = 0, count = fall.int(2, 4); j < count; j += 1) {
        const aloft = drop > 1.2 && fall.chance(0.6);
        const depth = aloft ? drop * fall.range(0.15, 0.8) : drop;
        const aside = fall.sym(aloft ? 0.3 + depth * 0.2 : 0.4 + drop * 0.1);
        const angle = aloft ? fall.range(0, 360) : (fall.chance(0.5) ? 0 : 180) + fall.sym(25);
        const born = Math.min(0.995, bloom.seedAt + fall.range(0.005, 0.03) * (j + 1));
        const seed = Math.floor(fall.u() * 4294967295);
        // How far the petal reaches from its base: one on the ground rests its lowest point on it, and none runs out
        // of a band or over the text beside the column.
        const [left, below, right] = reachOf(draw(createRng(seed), bloom.size, "bloom"), angle);
        const y = aloft ? Math.max(bloom.at[1] - depth, 0.05 - below) : lying - below + fall.range(0, 0.06);
        const besideText = page !== null && y > page.below - 1.2;
        const narrow = ornament === "cul-de-lampe" ? taper(y) - 0.3 : Infinity;
        const x = clamp(bloom.at[0] + aside, Math.max(0.05 - left, W / 2 - narrow), Math.min((ornament || besideText ? W : canvas) - 0.05 - right, W / 2 + narrow));
        items.push({ kind: "motif", order: order++, layer: aloft ? FALLING : FALLEN, name: "petal", at: [x, y], angle, size: bloom.size,
          seed, born, staged: false, seedAt: 2, leafRank: null, draw });
      }
    }
  }
  if (mirrored) {
    const mirror = (p: Pt): Pt => [canvas - p[0], p[1]];
    for (const item of items) {
      if (item.kind === "stem") item.points = item.points.map(mirror);
      else { item.at = mirror(item.at); item.angle = 180 - item.angle; }
    }
    crown = mirror(crown);
    guests = guests.map((place): GuestPlace => ({ ...place, at: mirror(place.at), angle: -place.angle, facing: place.facing === 1 ? -1 : 1 }));
  }
  return {
    form: formId, seed: spec.seed, width: canvas, height: H, column: mirrored ? [canvas - W, 0, canvas, H] : [0, 0, W, H], ornament, mirrored,
    items, mains: mirrored ? mainItems.map(item => item.points) : mains, crown, guests,
    foot: foot ? { seed: Math.imul(spec.seed, 7919) + 307, draw: foot.draw, x: mirrored ? canvas - W : footX, width: span / footScale, drop, scale: footScale } : null,
    stemInk: form.stemInk ?? null,
  };
}

/**
 * Seasons and foliage: the oldest staged motifs go to seed first, near the end of the day, and foliage
 * comes in as the day fills, lowest and oldest first. A motif outside the leaf layer keeps any rank it has.
 */
function ripen(items: GardenItem[], seed: number): void {
  const season = createRng(Math.imul(seed, 7919) + 211);
  const staged = items.filter((item): item is MotifItem => item.kind === "motif" && item.staged).sort((a, b) => a.born - b.born);
  staged.forEach((item, rank) => {
    const late = 0.8 + 0.17 * (rank / Math.max(1, staged.length - 1)) + season.sym(0.02);
    item.seedAt = Math.max(item.born + BUD_SPAN * 1.5, late);
  });
  const foliage = items.filter((item): item is MotifItem => item.kind === "motif" && item.layer === LAYER.leaf)
    .sort((a, b) => a.born - b.born || a.order - b.order);
  foliage.forEach((item, rank) => { item.leafRank = rank / foliage.length; });
}

/** What a festival grows from: the plant, and the two ways the growth loop lays out a garden for it. */
function festivalContext(form: PlantForm, formId: string, spec: GrowSpec): FestivalContext {
  const { W, H } = roomOf(spec);
  checkPage(spec.page ?? null, H);
  const ornament = spec.ornament ?? null;
  const { page: _page, ...alone } = spec;
  return {
    form, spec, width: W, height: H, ornament, ground: H * (1 - (ornament ? BAND_SKY : SKY)), footWidth: footColumn(form, ornament, W).width,
    rng: createRng(Math.imul(spec.seed, 7919) + 503),
    grow: (options = {}) => growPlain(options.form ?? form, formId, options.page === false ? alone : spec, options.mains ?? null, false),
    compose: (items, options = {}) => compose(form, formId, spec, items, options),
  };
}

/**
 * A festival's items, laid out in the column, made into a garden: numbered in order, ripened, and set on the
 * page beside the column when the spec has one. The column keeps its drawing on either side of the text, unmirrored.
 */
function compose(form: PlantForm, formId: string, spec: GrowSpec, items: GardenItem[], options: { mains?: Pt[][]; foot?: Foot["draw"] }): Garden {
  const { W, H } = roomOf(spec);
  const page = spec.page ?? null;
  items.forEach((item, index) => { item.order = index; });
  ripen(items, spec.seed);
  const canvas = W + (page?.text ?? 0);
  const x0 = page?.side === "right" ? canvas - W : 0;
  const shift = (p: Pt): Pt => [p[0] + x0, p[1]];
  // The crown is the highest point reached: a stem's, or a motif's head along its axis.
  const reached: Pt[] = [[x0 + W / 2, 0]];
  for (const item of items) {
    if (item.kind === "stem") { item.points = item.points.map(shift); reached.push(...item.points); continue; }
    item.at = shift(item.at);
    reached.push([item.at[0], item.at[1] + item.size * Math.max(0.3, Math.sin(item.angle * RAD))]);
  }
  const highest = reached.reduce((best, p) => p[1] > best[1] ? p : best);
  const crown: Pt = [highest[0], Math.min(H, highest[1])];
  return {
    form: formId, seed: spec.seed, width: canvas, height: H, column: [x0, 0, x0 + W, H], ornament: spec.ornament ?? null, mirrored: false,
    items, mains: (options.mains ?? []).map(points => points.map(shift)), crown, guests: [],
    foot: options.foot ? { seed: Math.imul(spec.seed, 7919) + 307, draw: options.foot, x: x0, width: W, drop: 0, scale: 1 } : null,
    stemInk: form.stemInk ?? null,
  };
}

/** A band's main stems, which of them lead their plants, and where its plants stand. */
interface BandStems { mains: Pt[][]; leads: boolean[]; roots: Pt[] }

/**
 * A bed's main stems: several plants along the band's foot, from `ground` up towards `top`, each of one or two
 * stems that sway a little and lean out towards the band's ends. A plant with a foot keeps one of them on its
 * crown, at `crownX`. A festival may lay each stem itself, from its plant's root.
 */
function bedStems(layout: Rng, form: PlantForm, W: number, ground: number, top: number, crownX: number | null, shaping: MainsShaping | null): BandStems {
  if (form.stems.count === 0) return { mains: [], leads: [], roots: crownX === null ? [] : [[crownX, ground]] };
  const count = Math.max(2, Math.round((W - 0.8) / BED_SPACING));
  const cell = (W - 0.8) / count;
  const xs = Array.from({ length: count }, (_, index) => 0.4 + cell * (index + 0.5) + layout.sym(cell * 0.16));
  if (crownX !== null) {
    let nearest = 0;
    xs.forEach((x, index) => { if (Math.abs(x - crownX) < Math.abs(xs[nearest]! - crownX)) nearest = index; });
    xs[nearest] = crownX;
  }
  const amplitude = Math.min(0.7, cell * form.stems.amplitude * 1.4);
  const mains: Pt[][] = [], leads: boolean[] = [], roots: Pt[] = [];
  for (const x of xs) {
    const root: Pt = [x, ground];
    roots.push(root);
    const stems = Math.min(form.stems.count, layout.chance(0.55) ? 2 : 1);
    const tall = layout.range(0.78, 1);
    const lean = (x - W / 2) / (W / 2) * 0.12 + layout.sym(0.06);
    for (let k = 0; k < stems; k += 1) {
      const end = ground + (top - ground) * (form.stems.tops[k] ?? form.stems.tops[0]!) * tall * (k === 0 ? 1 : layout.range(0.92, 1.06));
      const sway = fbm1(layout, 2), phase = layout.range(0, 10), lambda = layout.range(...form.stems.lambda);
      const apart = stems > 1 ? (k === 0 ? -0.18 : 0.18) : 0;
      const points: Pt[] = [];
      for (let y = ground; y <= end; y += 0.25) {
        const rise = y - ground;
        const wave = amplitude * (sway(y / lambda + phase) - sway(ground / lambda + phase)) * smoothstep(0, 1.5, rise);
        points.push([clamp(x + apart * smoothstep(0, 1.2, rise) + lean * rise + wave, 0.5, W - 0.5), y]);
      }
      mains.push(shaping ? shaping(mains.length, root, end, points) : points);
      leads.push(k === 0);
    }
  }
  return { mains, leads, roots };
}

/**
 * A cul-de-lampe's main stems, from one root in the middle of the band's foot: one rises straight towards `top`
 * and the others arch out in pairs to either side, the outer ones lowest, so that the spray widens upwards like the
 * tailpiece's inverted triangle. Each pair is nearly a mirror, never exactly one. Their tips keep `reach` from the
 * band's sides for their blooms. A festival may lay each stem itself, from the root to the height it would reach.
 */
function sprayStems(layout: Rng, form: PlantForm, W: number, root: Pt, top: number, reach: number, shaping: MainsShaping | null): BandStems {
  const count = form.stems.count === 0 ? 0 : form.stems.count === 1 ? 3 : 5;
  const pairs = (count - 1) / 2;
  const span = W / 2 - 0.5 - reach;
  const amplitude = Math.min(0.3, form.stems.amplitude * 2);
  const mains: Pt[][] = [], leads: boolean[] = [];
  for (let k = 0; k < count; k += 1) {
    const rank = Math.ceil(k / 2) / Math.max(1, pairs);
    const side = k === 0 ? 0 : k % 2 === 1 ? -1 : 1;
    const end: Pt = [
      root[0] + (k === 0 ? layout.sym(0.3) : side * span * rank * layout.range(0.86, 1)),
      root[1] + (top - root[1]) * (k === 0 ? 1 : lerp(0.88, 0.58, rank)) * layout.range(0.94, 1.04),
    ];
    const sway = fbm1(layout, 2), phase = layout.range(0, 10), lambda = layout.range(...form.stems.lambda);
    // It leaves the root upright, and the outer stems arch over to come down a little at their tips.
    const dx = end[0] - root[0], rise = end[1] - root[1];
    const curve = sample(bezier3(root, [root[0] + dx * 0.05, root[1] + rise * 0.55 + rank * 0.4], [end[0] - dx * 0.45, end[1] + rank * 0.9], end),
      Math.max(8, Math.round((Math.abs(dx) + rise) / 0.25)));
    const length = arcLength(curve);
    const points = curve.map(([x, y], index): Pt => {
      const along = length.at[index]!;
      const wave = amplitude * (sway(along / lambda + phase) - sway(phase)) * Math.sin(Math.PI * along / length.total);
      return [clamp(x + wave, 0.5, W - 0.5), y];
    });
    mains.push(shaping ? shaping(k, root, end[1], points) : points);
    leads.push(k === 0);
  }
  return { mains, leads, roots: [root] };
}

/** A branch leaving its stem tangentially and arriving along the motif's axis. */
function branchPath(rng: Rng, from: StemPoint, to: Pt, axis: Pt): Pt[] {
  const dx = to[0] - from.x, dy = to[1] - from.y;
  const d = Math.hypot(dx, dy);
  let tx = from.tx, ty = from.ty;
  if (tx * dx + ty * dy < -0.3 * d) { tx = -tx; ty = -ty; }
  const turn = (tx * dy - ty * dx > 0 ? 1 : -1) * rng.range(28, 48) * RAD;
  const ox = tx * Math.cos(turn) - ty * Math.sin(turn), oy = tx * Math.sin(turn) + ty * Math.cos(turn);
  return sample(bezier3([from.x, from.y], [from.x + ox * d * 0.45, from.y + oy * d * 0.45],
    [to[0] - axis[0] * d * 0.4, to[1] - axis[1] * d * 0.4], to), Math.max(6, Math.floor(d / 0.15)));
}

/** The share of the foliage a garden shows at `fullness` (0 empty, 1 full). */
export const foliageShown = (fullness: number): number => FOLIAGE_FLOOR + (1 - FOLIAGE_FLOOR) * clamp(fullness, 0, 1);

/**
 * What a motif shows at moment `t` of the day and its `fullness`, or null when it is not there.
 * Time brings the stems and the blooms' season; fullness brings the leaves, so a quiet day stays sparse.
 */
export function stageAt(item: MotifItem, t: number, fullness: number): Stage | null {
  if (t < item.born) return null;
  if (item.leafRank !== null && item.leafRank >= foliageShown(fullness)) return null;
  if (!item.staged) return "bloom";
  if (t >= item.seedAt) return "seed";
  return t < item.born + BUD_SPAN ? "bud" : "bloom";
}

/** How much of a stem has grown at moment `t`, from 0 to 1. */
export function stemShown(item: StemItem, t: number): number {
  if (t < item.born) return 0;
  if (item.grown <= item.born) return 1;
  return clamp((t - item.born) / (item.grown - item.born), 0, 1);
}

/** How far a drawing laid along `angle` reaches from its origin, as [left, below, right, above] offsets in centimetres. */
function reachOf(shapes: Shape[], angle: number): Rect {
  const a = (angle - 90) * RAD, c = Math.cos(a), s = Math.sin(a);
  let left = Infinity, below = Infinity, right = -Infinity, above = -Infinity;
  for (const shape of shapes) {
    for (const [x, y] of shape.type === "line" || shape.type === "dots" ? shape.points : shape.outline) {
      const u = x * c - y * s, v = x * s + y * c;
      left = Math.min(left, u); right = Math.max(right, u); below = Math.min(below, v); above = Math.max(above, v);
    }
  }
  return [left, below, right, above];
}
