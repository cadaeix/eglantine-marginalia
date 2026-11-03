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
import { createField, type Rect } from "./field.js";
import { type Foot, type FormModule, LAYER, type PlantForm, resolveVariant, type Stage, type StemInk, type Variant } from "./form.js";
import { plantForm } from "./registry.js";
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
  /** Where the column stands on the canvas, as [x0, y0, x1, y1]. */
  column: Rect;
  /** Laid out for a column right of its text, as the mirror of a left-hand garden: its motifs are drawn mirrored. */
  mirrored: boolean;
  items: GardenItem[];
  /** The main stems' centrelines, for whatever must thread between them. */
  mains: Pt[][];
  /** The head of the tallest bloom: the highest point the garden reaches. */
  crown: Pt;
  /** Where the day's guest stands, if the day has one. */
  guest: GuestPlace | null;
  /** What the plant grows out of, drawn at each moment, if not bare ground. */
  foot: { seed: number; draw: Foot["draw"] } | null;
  /** How the stems are inked, if not as plain ribbons. */
  stemInk: StemInk | null;
}

/**
 * A figure the day brings besides the plant. A visitor (an animal) comes into the garden among the
 * stems, facing the plant it grazes; a figure at rest (a tool) lies near the foot with no one holding it.
 */
export interface Guest {
  kind: "visitor" | "rest";
  /** The figure's width over its height. */
  aspect: number;
  /** Its height in centimetres for a visitor, its length for a figure at rest. */
  size: number;
}
export interface GuestPlace {
  kind: Guest["kind"];
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
  /** A registered plant form's id (see registry.ts) or a form of your own, and the variant that tunes it for one plant. */
  form: string | FormModule;
  variant?: Variant;
  /**
   * The column, in centimetres; 6 × 22 by default. The forms are drawn for that column: their sizes are
   * in centimetres and a foot is placed in it, so a much smaller or larger column crowds or empties them.
   */
  width?: number;
  height?: number;
  /** The page beside the column; without it the garden keeps to its column. */
  page?: Page;
  guest?: Guest;
}

const REACH = 3.0;
/** The top of the column stays open sky. */
const SKY = 0.2;
const SMALLEST = 0.36;
const FILLMIN = 0.26;
const FILLERS = 12;
const STEM_PHASE = 0.3;
const BUD_SPAN = 0.1;
/** At fullness 0 a garden already shows this share of its leaves, so the plant is never bare. */
const FOLIAGE_FLOOR = 0.3;
/**
 * Lattice cells in the column the forms are drawn for. A garden on a page holds more of each motif as its
 * room grows; a column alone keeps its form's counts at any size, as it always has.
 */
const BASE_CELLS = createField([[0.15, 0.3, COLUMN.width - 0.15, COLUMN.height * (1 - SKY)]]).x.length;

interface StemPoint { x: number; y: number; tx: number; ty: number; w: number }

export function growGarden(spec: GrowSpec): Garden {
  const form: PlantForm = typeof spec.form === "string" ? plantForm(spec.form, spec.variant) : spec.form.build(resolveVariant(spec.form, spec.variant));
  const formId = typeof spec.form === "string" ? spec.form : spec.form.id;
  const { width: W = COLUMN.width, height: H = COLUMN.height } = spec;
  const page = spec.page ?? null;
  if (page && (!(page.side === "left" || page.side === "right") || !(Number.isFinite(page.text) && page.text > 0) || !(page.below >= 0 && page.below <= H))) {
    throw new RangeError(`A page needs a side, left or right, text wider than 0 cm, and room below the text from 0 to the column's ${H} cm`);
  }
  const mirrored = page?.side === "right";
  const canvas = W + (page?.text ?? 0);
  const G = H * (1 - SKY);
  const root = createRng(Math.imul(spec.seed, 7919) + 13);
  const layout = root.fork();
  const season = createRng(Math.imul(spec.seed, 7919) + 211);
  const items: GardenItem[] = [];
  let order = 0;
  const column: Rect = [0.15, 0.3, W - 0.15, G];
  const foot = form.foot ?? null;
  // The page draws from a stream of its own, so the runner's length, chosen here, never moves the main stems.
  const spread = createRng(Math.imul(spec.seed, 7919) + 409);
  let ground: Rect | null = null, room: Rect | null = null;
  if (page) {
    // A foot is its own ground, standing in the column: only bare ground sends a runner under the text, along
    // a band no lower than its leaflets need, and beside a foot the room under the text begins at the foot's
    // top, since below that it lies underground.
    if (!foot && page.below >= 2) ground = [W - 0.16, 0.3, W + page.text * spread.range(0.42, 0.52), Math.min(1.75, page.below - 0.45)];
    const base = foot ? Math.max(...foot.room.map(rect => rect[3])) + 0.1 : 0.3;
    // Sprays and blooms reach past their room's edge, so the room stops well short of the last line.
    if (page.below - 1.2 - base > 2.5) room = [W - 0.16, base, W + page.text - 0.6, page.below - 1.2];
  }
  const field = createField([column, ...(ground ? [ground] : []), ...(room ? [room] : [])]);
  const plenty = page ? Math.max(1, field.x.length / BASE_CELLS) : 1;
  const nearestStemDistance = new Float64Array(field.x.length).fill(Infinity);
  const stemPoints: StemPoint[] = [];

  const addStemPoints = (points: Pt[], w0: number, w1: number, every = 1): void => {
    for (let index = 0; index < points.length; index += every) {
      const a = points[Math.max(0, index - 1)]!, b = points[Math.min(points.length - 1, index + 1)]!;
      const [tx, ty] = unit(b[0] - a[0], b[1] - a[1]);
      const p = points[index]!;
      stemPoints.push({ x: p[0], y: p[1], tx, ty, w: lerp(w0, w1, index / Math.max(1, points.length - 1)) });
      field.eachNear(p[0], p[1], REACH, cell => {
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
  const motif = (name: string, at: Pt, angle: number, size: number, layer: number, born: number, staged: boolean,
    draw: MotifItem["draw"]): MotifItem => {
    const item: MotifItem = { kind: "motif", order: order++, layer, name, at, angle, size, seed: Math.floor(layout.u() * 4294967295),
      born, staged, seedAt: 2, leafRank: null, draw };
    items.push(item);
    return item;
  };

  // ---------------------------------------------------------------- 1. the foot, then the main stems out of it
  // A right-hand page is drawn as the mirror of this layout, but its foot is drawn as it is: the room the
  // foot fills is mirrored here so that it lands under the drawing.
  if (foot) for (const [x0, y0, x1, y1] of foot.room) field.block(mirrored ? [(1 - x1) * W, y0, (1 - x0) * W, y1] : [x0 * W, y0, x1 * W, y1]);
  const rootAt: Pt = foot ? [W * (mirrored ? 1 - foot.crown[0] : foot.crown[0]), foot.crown[1]] : [W * layout.range(0.22, 0.3), 0.75];
  const centre = W * 0.47, amplitude = W * form.stems.amplitude * 2.2;
  const mains: Pt[][] = [];
  const mainItems: StemItem[] = [];
  const tops = form.stems.tops.map((top, index) => G * (index === 0 ? top : top * layout.range(0.92, 1.06)));
  for (let k = 0; k < form.stems.count; k += 1) {
    const sway = fbm1(layout, 2);
    const phase = layout.range(0, 10), lambda = layout.range(...form.stems.lambda);
    const x0 = rootAt[0] + (k - 1) * 0.2;
    const points: Pt[] = [];
    for (let y = rootAt[1]; y <= tops[k]!; y += 0.25) {
      let x = centre + amplitude * sway(y / lambda + phase) + (k - 1) * 0.4;
      x = lerp(x0, x, smoothstep(0, 4, y - rootAt[1]));
      points.push([clamp(x, 0.8, W - 0.8), y]);
    }
    mains.push(points);
  }
  const longest = Math.max(...mains.map(points => arcLength(points).total));
  mains.forEach((points, k) => {
    const w0 = form.stems.width * (k === 0 ? 1 : 0.8);
    const grown = STEM_PHASE * arcLength(points).total / longest;
    mainItems.push(stem(points, w0, Math.max(0.025, form.stems.width * 0.3), 0, grown, 0.1, true));
    addStemPoints(points, w0, 0.028);
  });
  // On bare ground the root curls into a scroll at the corner.
  if (!foot || foot.scroll) {
    const turns = layout.range(1.2, 1.6);
    const scroll = sample(t => {
      const a = Math.PI * 0.5 + t * turns * 2 * Math.PI;
      const r = 0.5 * (1 - 0.85 * t) ** 1.3;
      return [rootAt[0] - 0.5 - r * Math.cos(a), rootAt[1] + 0.05 + r * Math.sin(a)];
    }, 40);
    stem(scroll, form.stems.width * 0.7, 0.012, 0, 0.06);
  }

  // ---------------------------------------------------------------- 2. terminal blooms
  // A foot with no stems above it is the whole garden, and its top is the highest point.
  let crown: Pt = foot && form.stems.count === 0 ? [rootAt[0], Math.max(rootAt[1], ...foot.room.map(rect => rect[3]))] : [W / 2, 0];
  mains.forEach((points, k) => {
    const tip = points[points.length - 1]!, before = points[Math.max(0, points.length - 3)]!;
    const [hx, hy] = unit(tip[0] - before[0], tip[1] - before[1]);
    const size = k === 0 ? Math.min(form.terminal.size[1], W * 0.27) : layout.range(...form.terminal.size) * 0.85;
    const at: Pt = [tip[0] + hx * 0.05, tip[1] + hy * 0.05];
    motif("terminal", at, k === 0 ? 90 : degrees(hx, hy), size, LAYER.bloom, mainItems[k]!.grown, true, form.terminal.draw);
    const r = form.terminal.r(size);
    field.disc(at[0] + hx * r * 0.6, at[1] + hy * r * 0.6, r * 1.1, 0.85);
    if (at[1] + r * 1.4 > crown[1]) crown = [at[0], Math.min(H, at[1] + r * 1.4)];
  });

  // ---------------------------------------------------------------- 2b. the day's guest, before the leaves, so they grow around it
  let guest: GuestPlace | null = null;
  if (spec.guest) {
    // Its own stream: the guest's choices never move the rest of the layout's draws.
    const visit = createRng(Math.imul(spec.seed, 7919) + 101);
    const { kind, aspect, size } = spec.guest;
    const wantedWidth = kind === "visitor" ? size * aspect : size, wantedHeight = kind === "visitor" ? size : size / aspect;
    const tilt = kind === "rest" ? 7 : 4;
    const fitAngle = Math.min(tilt * RAD, Math.atan2(wantedHeight, wantedWidth));
    const span = wantedWidth * Math.cos(fitAngle) + wantedHeight * Math.sin(fitAngle);
    const fit = Math.min(1, (W - 0.3) / span);
    const width = wantedWidth * fit, height = wantedHeight * fit, halfSpan = span * fit / 2;
    const reach = Math.max(width, height) * 0.5;
    let best = -Infinity;
    // A foot that spans the column, such as a bed of strata, is the ground the guest stands or lies on.
    const floor = foot ? Math.max(0, ...foot.room.filter(rect => rect[2] - rect[0] > 0.5).map(rect => rect[3])) : 0;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      let at: Pt, facing: 1 | -1;
      let stemX: number | null = null;
      if (kind === "visitor" && mains.length > 0) {
        const points = visit.pick(mains);
        const p = points[Math.floor(points.length * visit.range(0.25, 0.7))]!;
        const side = visit.chance(0.5) ? 1 : -1;
        at = [p[0] + side * (width / 2 + 0.12), p[1] + height * 0.15];
        facing = side > 0 ? -1 : 1;
        stemX = p[0];
      } else if (kind === "visitor") {
        at = [visit.range(width / 2 + 0.3, W - width / 2 - 0.3), floor + height / 2 + visit.range(0.1, 0.6)];
        facing = visit.chance(0.5) ? 1 : -1;
      } else {
        at = [visit.range(width / 2 + 0.3, W - width / 2 - 0.3), floor + visit.range(height / 2 + 0.45, 2.2)];
        facing = visit.chance(0.5) ? 1 : -1;
      }
      at[0] = clamp(at[0], halfSpan + 0.15, W - halfSpan - 0.15);
      if (stemX !== null && at[0] !== stemX) facing = at[0] > stemX ? -1 : 1;
      const room = Math.min(field.freeAt(at[0], at[1]), field.freeAt(at[0] - width * 0.35, at[1]), field.freeAt(at[0] + width * 0.35, at[1]));
      if (room > best) {
        best = room;
        guest = { kind, at, width, height, angle: visit.sym(tilt), facing, born: kind === "rest" ? 0 : 0.2 };
      }
    }
    if (guest) for (const f of [-0.3, 0, 0.3]) field.disc(guest.at[0] + guest.width * f, guest.at[1], Math.max(guest.height * 0.6, reach * 0.55), 1);
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
      motif("terminal", at, degrees(hx, hy), size, LAYER.bloom, arc.grown, true, form.terminal.draw);
      const r = form.terminal.r(size);
      field.disc(at[0] + hx * r * 0.6, at[1] + hy * r * 0.6, r * 1.1, 0.85);
      if (at[1] + r * 1.4 > crown[1]) crown = [at[0], Math.min(H, at[1] + r * 1.4)];
    }
  }

  // ---------------------------------------------------------------- 3. leaves: a basal rosette, then the nodes
  if (form.basal) {
    const count = layout.int(...form.basal.count);
    for (let k = 0; k < count; k += 1) {
      const spread = (k / Math.max(1, count - 1)) * 2 - 1;
      const angle = 90 + spread * 48 + layout.sym(6);
      const length = layout.range(...form.basal.length) * (1 - 0.35 * Math.abs(spread));
      const base: Pt = [rootAt[0] + spread * 0.25, rootAt[1] - 0.05];
      const bend = -spread * layout.range(0.08, 0.2);
      motif("basal", base, angle, length, LAYER.leaf, 0.01 + 0.08 * (k / count), false, (rng, size) => form.leaf(rng, size, bend));
      for (const f of [0.3, 0.55, 0.8]) field.disc(base[0] + Math.cos(angle * RAD) * length * f, base[1] + Math.sin(angle * RAD) * length * f, 0.12 * length, 0.85);
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
      let fits = false;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (field.freeAt(p[0] + ux * length * 0.55, p[1] + uy * length * 0.55) >= leafProxy * length) { fits = true; break; }
        length *= 0.75;
      }
      if (!fits || length < 0.6) continue;
      const bend = sideOf * layout.range(0.05, 0.25);
      const born = lerp(item.born, item.grown, lengths[index]! / total) + 0.005;
      motif("leaf", p, angle, length, LAYER.leaf, born, false, (rng, size) => form.leaf(rng, size, bend));
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
      if (nearestStemDistance[index]! > REACH) continue;
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
          leaves.push(motif("leaflet", p, angle, length, LAYER.leaf, 0, false, (rng, s) => form.leaflet(rng, s, bend)));
          field.disc(p[0] + Math.cos(angle * RAD) * length * 0.5, p[1] + Math.sin(angle * RAD) * length * 0.5, 0.25 * length, 0.7);
        }
      }
    }
    const placed = motif(pick.name, origin, degrees(ax, ay), size, pick.layer, 0, pick.staged ?? false, pick.draw);
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
    fillers.push(motif("filler", [from.x, from.y], degrees(dx, dy + 0.3), length, LAYER.leaf, 0, false, (rng, s) => form.leaflet(rng, s, bend)));
    field.disc(px, py, best, 0.9);
  }
  fillers.forEach((item, index) => { item.born = 0.84 + 0.1 * index / Math.max(1, fillers.length); });

  // ---------------------------------------------------------------- 6. seasons: the oldest blooms go to seed first, near the end
  const staged = items.filter((item): item is MotifItem => item.kind === "motif" && item.staged).sort((a, b) => a.born - b.born);
  staged.forEach((item, rank) => {
    const late = 0.8 + 0.17 * (rank / Math.max(1, staged.length - 1)) + season.sym(0.02);
    item.seedAt = Math.max(item.born + BUD_SPAN * 1.5, late);
  });
  // ---------------------------------------------------------------- 7. foliage comes in as the day fills, lowest and oldest first
  const foliage = items.filter((item): item is MotifItem => item.kind === "motif" && item.layer === LAYER.leaf)
    .sort((a, b) => a.born - b.born || a.order - b.order);
  foliage.forEach((item, rank) => { item.leafRank = rank / foliage.length; });
  if (mirrored) {
    const mirror = (p: Pt): Pt => [canvas - p[0], p[1]];
    for (const item of items) {
      if (item.kind === "stem") item.points = item.points.map(mirror);
      else { item.at = mirror(item.at); item.angle = 180 - item.angle; }
    }
    crown = mirror(crown);
    if (guest) guest = { ...guest, at: mirror(guest.at), angle: -guest.angle, facing: guest.facing === 1 ? -1 : 1 };
  }
  return {
    form: formId, seed: spec.seed, width: canvas, height: H, column: mirrored ? [canvas - W, 0, canvas, H] : [0, 0, W, H], mirrored,
    items, mains: mirrored ? mainItems.map(item => item.points) : mains, crown, guest,
    foot: foot ? { seed: Math.imul(spec.seed, 7919) + 307, draw: foot.draw } : null,
    stemInk: form.stemInk ?? null,
  };
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
