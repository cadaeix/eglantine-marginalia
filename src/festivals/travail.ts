// The festival of Labour: the sheaf. The year's harvest is in, so the plant is cut a little above where it
// rose and bound: its stalks stand on their cut ends at the foot of the column, gathered tight under a
// twisted straw tie a third of the way up and fanning out above it to the plant's own spread, with more
// stalks cut from the same field to give the bundle its body. Below the tie the stalks are bare; above it the
// plant keeps its leaves, blooms and fruit, so the marron becomes a bound handful of chestnut branches whose
// burrs open at the end of the day. On the day of Labour the tool that lies at a plant's foot every tenth
// day is gone: the work is done. A plant that stands on something (a root under its soil, a stub, a bed of
// rock) is cut above it and leaves it behind; a plant with no stems of its own is gathered as a faggot of
// sticks bearing what it grows.
//
// A cul-de-lampe binds its spray in one sheaf, which tapers to its cut ends as the tailpiece does. A bandeau's
// bed is bound as a row of small sheaves stood along the field, one for each of its plants, each opening
// sooner above its tie, since a band's plants are short.
//
// Time brings the stalks up from their cut ends through the morning, as it brings any stem, and the tie once
// they reach it; buds, blooms and seed keep the plant's own season. Fullness brings the foliage as it always does.
import type { FestivalContext, FestivalModule } from "../festival.js";
import { LAYER, type PlantForm, type Stage } from "../form.js";
import type { Garden, GardenItem, MotifItem, StemItem } from "../garden.js";
import { arcLength, bezier3, clamp, degrees, lerp, type Pt, RAD, sample, smoothstep, unit } from "../geometry.js";
import { circle, HATCH, line, turn } from "../kit.js";
import { createRng, type Rng } from "../random.js";
import type { Body, Shape } from "../shapes.js";

/** How far above where the stems rose they are cut, in centimetres. */
const CUT = 0.5;
/** The height the cut ends stand at, above the paper's foot. */
const FOOT = 0.4;
/** The tie's height up the tallest stalk, as a share of it. */
const BAND = 0.3;
/** Half the height over which the stalks are held parallel under the tie. */
const WAIST = 0.2;
/** How far above the tie the stalks take to fan out to the plant's own spread. */
const SPLAY = 4.2;
/** How far the cut ends splay out from the column's centre at most. */
const SPREAD = 1.3;
/** How far from upright the stalks added to the bundle lean above the tie at most. */
const FAN = 26 * RAD;
/** The tie lies over the stalks and under the leaves. */
const TIE_LAYER = 2.5;
/** The cut faces lie just over their stalks. */
const CUT_LAYER = 2.1;
/** The rope's thickness, and the number of turns it takes round the waist. */
const ROPE = 0.13;
const TURNS = 2;
/**
 * A plant with no stems of its own is gathered as sticks laid out like these, as thick as the broken stub its
 * bloom is drawn on, so each stick ends in it.
 */
const STICKS: PlantForm["stems"] = { count: 3, amplitude: 0.05, lambda: [6, 9], width: 0.16, tops: [0.8, 0.68, 0.58] };
/** A bed's sheaves are smaller: fewer stalks are added to each, as a share of a lone sheaf's. */
const BED_EXTRAS = 0.45;

/** A stalk of the sheaf as it is laid: its centreline from the cut end, widths and growth. */
interface Stalk { points: Pt[]; w0: number; w1: number; born: number; grown: number; main: boolean }

/** Where a sheaf is bound: the x it is gathered to, the room [x0, x1] its added heads keep to, and how far its cut ends splay from it. */
interface Place { centre: number; room: [number, number]; spread: number }

/** A sheaf as it is bound: its items, its own stalks, and where it stands. */
interface Sheaf { items: GardenItem[]; mains: Pt[][]; centre: number; spread: number }

function grow(context: FestivalContext): Garden {
  const { width: W } = context;
  // The plant is grown on bare ground: whatever it stood on is left behind, and a stemless plant gets sticks.
  const { foot: _foot, ...bare } = context.form;
  const form: PlantForm = bare.stems.count > 0 ? bare : { ...bare, stems: STICKS, nodes: { ...bare.nodes, below: 0 } };
  const garden = context.grow({ page: false, form });
  const mains = garden.items.filter((item): item is StemItem => item.kind === "stem" && item.main);
  // The root's scroll is the only stem besides the mains born at dawn; branches come later in the day.
  const branches = garden.items.filter((item): item is StemItem => item.kind === "stem" && !item.main && item.born > 0);
  const motifs = garden.items.filter((item): item is MotifItem => item.kind === "motif");

  // Each plant is bound in a sheaf of its own: the column's and a cul-de-lampe's one plant, or each of a bed's,
  // whose stems rise from its root.
  let sheaves: Sheaf[];
  if (context.ornament !== "bandeau") sheaves = [sheaf(context, form, mains, branches, motifs, { centre: W / 2, room: [0, W], spread: SPREAD })];
  else {
    const roots = [...new Set(mains.map(item => item.points[0]![0]))];
    // A branch belongs to the plant whose stem it leaves, and a motif to the plant whose stem bears it, or else to the nearest.
    const plantOf = new Map<string, number>();
    const key = (p: Pt): string => `${p[0]},${p[1]}`;
    for (const item of mains) for (const p of item.points) plantOf.set(key(p), roots.indexOf(item.points[0]![0]));
    const branchesOf = roots.map((): StemItem[] => []), motifsOf = roots.map((): MotifItem[] => []);
    for (const item of branches) {
      const plant = plantOf.get(key(item.points[0]!));
      if (plant === undefined) continue;
      branchesOf[plant]!.push(item);
      for (const p of item.points.slice(1)) plantOf.set(key(p), plant);
    }
    const nearest = (x: number): number => roots.reduce((best, root, index) => Math.abs(root - x) < Math.abs(roots[best]! - x) ? index : best, 0);
    for (const item of motifs) motifsOf[plantOf.get(key(item.at)) ?? nearest(item.at[0])]!.push(item);
    sheaves = roots.map((root, index) => {
      const x0 = index === 0 ? 0 : (roots[index - 1]! + root) / 2, x1 = index === roots.length - 1 ? W : (root + roots[index + 1]!) / 2;
      const spread = Math.min(SPREAD, Math.min(root - x0, x1 - root) * 0.55);
      return sheaf(context, form, mains.filter(item => item.points[0]![0] === root), branchesOf[index]!, motifsOf[index]!, { centre: root, room: [x0, x1], spread });
    });
  }
  return context.compose(sheaves.flatMap(bound => bound.items), {
    mains: sheaves.flatMap(bound => bound.mains),
    foot: r => sheaves.flatMap(bound => ground(r, bound.centre, bound.spread)),
  });
}

/** Binds the plant's main stems, with the branches and motifs they bear, in a sheaf at `place`. */
function sheaf(context: FestivalContext, form: PlantForm, mains: StemItem[], branches: StemItem[], motifs: MotifItem[], place: Place): Sheaf {
  const { rng, width: W, ornament } = context;
  const { centre } = place;

  // ---------------------------------------------------------------- the cut, the band and the map that binds
  const rootY = mains[0]!.points[0]![1];
  const shift = rootY + CUT - FOOT;
  const tallest = Math.max(...mains.map(item => item.points[item.points.length - 1]![1])) - shift;
  const band = FOOT + BAND * (tallest - FOOT);
  const waistLow = band - WAIST, waistTop = band + WAIST;
  // A band's plants are short, so their sheaves open sooner above the tie, to the plant's own spread.
  const splay = ornament ? Math.min(SPLAY, (tallest - waistTop) * 0.8) : SPLAY;
  /** The plant's axis at an original height: the mean of its main stems, each held at its tip beyond it. */
  const axisAt = (y: number): number => mains.reduce((sum, item) => sum + xAt(item.points, y), 0) / mains.length;
  const offsets = mains.map(item => Math.abs(xAt(item.points, band + shift) - axisAt(band + shift)));
  const width = form.stems.width;
  const counted = clamp(Math.round(0.8 / width), 6, 16) + rng.int(0, 2);
  const extras = ornament === "bandeau" ? Math.max(3, Math.round(counted * BED_EXTRAS)) : counted;
  const half = clamp(0.6 * Math.sqrt(extras + mains.length) * width, 0.16, 0.32);
  const squeeze = Math.min(0.4, half * 0.7 / Math.max(0.05, ...offsets));
  /**
   * The binding: everything is lowered to the cut, and pinched horizontally toward the sheaf's centre as a
   * smooth function of height, tight in the waist and opening above it to the plant's own spread.
   */
  const bind = (p: Pt): Pt => {
    const y = p[1] - shift;
    const open = smoothstep(waistTop, waistTop + splay, y);
    const axis = axisAt(p[1]);
    return [lerp(centre, axis, open) + (p[0] - axis) * lerp(squeeze, 1, open), y];
  };

  // ---------------------------------------------------------------- the stalks: the plant's own, then more from the field
  // A main stem too short to reach well above the tie is left out, with whatever it bore: the stalks added
  // below stand in for it.
  const rising = mains.map(item => ({ item, upper: item.points.filter(p => p[1] - shift >= waistLow).map(bind) }))
    .filter(({ upper }) => upper.length >= 3 && upper[upper.length - 1]![1] >= waistTop + 0.6);
  // The cut ends are spread evenly over the foot and dealt to the stalks at random, so that, running
  // straight from their ends into the tie, the stalks cross one another every way just under it.
  const feet = shuffle(rng, Array.from({ length: rising.length + extras }, (_, k) => centre + place.spread * (((k + rng.range(0.2, 0.8)) / (rising.length + extras)) * 2 - 1)));
  /** The stalk below the waist: nearly straight from its cut end up to `start`, bending only to arrive along `heading`. */
  const lower = (start: Pt, heading: Pt): Pt[] => {
    const from: Pt = [feet.pop()!, FOOT + rng.range(0, 0.06)];
    const d = Math.hypot(start[0] - from[0], start[1] - from[1]);
    return sample(bezier3(from, [lerp(from[0], start[0], 0.35), lerp(from[1], start[1], 0.35)],
      [start[0] - heading[0] * d * 0.15, start[1] - heading[1] * d * 0.15], start), Math.max(4, Math.ceil(d / 0.25)));
  };
  const speed = arcLength(mains[0]!.points).total / Math.max(0.01, mains[0]!.grown);
  const stalks: Stalk[] = rising.map(({ item, upper }) => {
    const start = upper[0]!;
    const points = [...lower(start, unit(upper[1]![0] - start[0], upper[1]![1] - start[1])).slice(0, -1), ...upper];
    return { points, w0: item.w0, w1: item.w1, born: 0, grown: item.grown * arcLength(points).total / arcLength(item.points).total, main: true };
  });

  // ---------------------------------------------------------------- what the plant keeps above the tie
  const clear = waistTop + 0.25;
  const key = (p: Pt): string => `${p[0]},${p[1]}`;
  const alive = new Set<string>();
  const owner = new Map<string, StemItem>();
  const risen = new Set(rising.map(({ item }) => item));
  for (const item of mains) for (const p of item.points) {
    owner.set(key(p), item);
    if (risen.has(item) && p[1] - shift >= clear) alive.add(key(p));
  }
  // A branch stands if it leaves a stem that stands and keeps clear of the waist; a branch begins on an earlier stem.
  const standing = new Set<StemItem>();
  for (const item of branches) {
    if (!alive.has(key(item.points[0]!)) || item.points.some(p => p[1] - shift < clear)) continue;
    standing.add(item);
    for (const p of item.points) alive.add(key(p));
  }
  for (const item of branches) for (const p of item.points.slice(1)) owner.set(key(p), item);
  const kept: MotifItem[] = [];
  const bearing = new Set<StemItem>();
  for (const item of motifs) {
    const at = bind(item.at);
    const ahead = bind([item.at[0] + Math.cos(item.angle * RAD) * 0.05, item.at[1] + Math.sin(item.angle * RAD) * 0.05]);
    const angle = degrees(ahead[0] - at[0], ahead[1] - at[1]);
    const stem = owner.get(key(item.at));
    if (stem && !(stem.main ? risen.has(stem) : standing.has(stem))) continue;
    // Leaves keep clear of the tie as they hang; blooms and fruit stand well above it, so they never crowd the waist.
    if (at[1] + Math.min(0, Math.sin(angle * RAD)) * item.size * 0.85 < clear + (item.layer >= LAYER.bloom ? 0.8 : 0)) continue;
    const fit = fitted({ ...item, at, angle }, W, context.height);
    if (!fit) continue;
    kept.push(fit);
    if (stem) bearing.add(stem);
  }
  // A branch left with nothing on it, neither a motif nor a branch of its own, is cut away too.
  for (let index = branches.length - 1; index >= 0; index -= 1) {
    const item = branches[index]!;
    if (!standing.has(item)) continue;
    if (!bearing.has(item)) { standing.delete(item); continue; }
    const parent = owner.get(key(item.points[0]!));
    if (parent) bearing.add(parent);
  }

  // ---------------------------------------------------------------- more stalks from the same field, each with its head and a leaf or two
  // Their heads stand at heights spread through the fan the binding has thinned, from just above the tie to
  // well into the plant; each leans the way that leaves it most room among the heads already there, and
  // never out of its room. A band's short sheaf spreads them through its own height.
  const heads: Pt[] = kept.filter(item => item.layer >= LAYER.bloom).map(item => item.at);
  const crops: MotifItem[] = [];
  const motif = (name: string, at: Pt, angle: number, size: number, layer: number, born: number, staged: boolean, draw: MotifItem["draw"]): void => {
    const fit = fitted({ kind: "motif", order: 0, layer, name, at, angle, size, seed: Math.floor(rng.u() * 4294967295), born, staged, seedAt: 2, leafRank: null, draw }, W, context.height);
    if (fit) crops.push(fit);
  };
  const lowest = ornament ? (tallest - waistTop) * 0.4 : 1.8;
  const highest = ornament ? (tallest - waistTop) * 0.85 : Math.max(lowest + 0.5, (tallest - waistTop) * 0.66);
  const tiers = shuffle(rng, Array.from({ length: extras }, (_, k) => k));
  for (let k = 0; k < extras; k += 1) {
    // Stratified across the waist, so the bundle is full from edge to edge.
    const across = ((k + rng.range(0.15, 0.85)) / extras) * 2 - 1;
    const start: Pt = [centre + across * half * 0.92, waistLow];
    const size = rng.range(...form.terminal.size) * 0.72;
    const r = form.terminal.r(size);
    const up = lerp(lowest, highest, (tiers[k]! + rng.u()) / extras);
    let room = -Infinity, lean = across;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const l = clamp(across + rng.sym(0.8), -1, 1);
      const x = start[0] + Math.sin(l * FAN) * up * 0.9;
      const margin = Math.min(x - r - place.room[0], place.room[1] - x - r) - 0.3;
      const free = Math.min(3, ...heads.map(head => Math.hypot(head[0] - x, head[1] - waistTop - up))) + Math.min(0, margin) * 4;
      if (free > room) { room = free; lean = l; }
    }
    const tip: Pt = [start[0] + Math.sin(lean * FAN) * up * 0.9, waistTop + up];
    heads.push(tip);
    const fan = sample(bezier3([start[0], waistTop], [start[0], waistTop + up * 0.3],
      [lerp(start[0], tip[0], 0.5), waistTop + up * 0.65], tip), Math.max(4, Math.ceil(up / 0.25)));
    const points = [...lower(start, [0, 1]).slice(0, -1), start, ...fan];
    const born = rng.range(0, 0.04);
    const stalk: Stalk = { points, w0: width * rng.range(0.6, 0.9), w1: Math.max(0.012, width * 0.25), born, grown: born + arcLength(points).total / speed, main: false };
    stalks.push(stalk);
    const { at: lengths, total } = arcLength(points);
    const before = points[points.length - 2]!;
    motif("terminal", tip, degrees(tip[0] - before[0], tip[1] - before[1]), size, LAYER.bloom, stalk.grown, true, form.terminal.draw);
    // A leaf or two on the way up, alternating sides, where the plant bears leaves at that height.
    let sideOf = rng.chance(0.5) ? 1 : -1;
    for (const share of up > 2.2 ? [0.45, 0.75] : [0.6]) {
      const index = points.length - fan.length + Math.floor((fan.length - 1) * share);
      const p = points[index]!, q = points[index + 1]!;
      if (p[1] / context.ground > form.nodes.below) continue;
      sideOf = -sideOf;
      const bend = sideOf * rng.range(0.05, 0.25);
      motif("leaf", p, degrees(q[0] - p[0], q[1] - p[1]) + sideOf * rng.range(...form.nodes.angle),
        form.nodes.length(p[1] / context.ground) * rng.range(0.6, 0.8), LAYER.leaf, lerp(stalk.born, stalk.grown, lengths[index]! / total) + 0.005, false, (r, s) => form.leaf(r, s, bend));
    }
  }

  // ---------------------------------------------------------------- the sheaf: stalks, branches, the cut faces, the tie, the plant above
  const items: GardenItem[] = stalks.map((stalk): StemItem => ({ kind: "stem", order: 0, layer: mains[0]!.layer, ...stalk }));
  for (const item of branches) if (standing.has(item)) items.push({ ...item, points: item.points.map(bind) });
  const tied = Math.max(...stalks.map(stalk => {
    const { at, total } = arcLength(stalk.points);
    const index = Math.max(0, stalk.points.findIndex(p => p[1] >= waistTop));
    return lerp(stalk.born, stalk.grown, at[index]! / total);
  }));
  const ends = stalks.map(stalk => {
    const [a, b] = [stalk.points[0]!, stalk.points[1]!];
    return { at: [a[0] - centre, a[1] - FOOT] as Pt, angle: Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2, w: stalk.w0 };
  });
  const xs = stalks.map(stalk => xAt(stalk.points, band));
  const girth = Math.max(...xs) - Math.min(...xs) + Math.max(...stalks.map(stalk => stalk.w0)) + ROPE * 0.6;
  const middle = (Math.max(...xs) + Math.min(...xs)) / 2;
  const tieSide = rng.chance(0.5) ? 1 : -1;
  items.push(
    { kind: "motif", order: 0, layer: CUT_LAYER, name: "cut ends", at: [centre, FOOT], angle: 90, size: 1, seed: Math.floor(rng.u() * 4294967295),
      born: 0, staged: false, seedAt: 2, leafRank: null, draw: (r) => ends.flatMap(end => cutFace(r, end.at, end.angle, end.w)) },
    { kind: "motif", order: 0, layer: TIE_LAYER, name: "tie", at: [middle, band], angle: 90, size: girth, seed: Math.floor(rng.u() * 4294967295),
      born: Math.min(0.5, tied), staged: false, seedAt: 2, leafRank: null, draw: (r, s) => tie(r, s, tieSide) },
    ...kept,
    ...crops,
  );
  const spread = Math.max(...ends.map(end => Math.abs(end.at[0]))) + 0.35;
  return { items, mains: stalks.filter(stalk => stalk.main).map(stalk => stalk.points), centre, spread };
}

/**
 * The motif turned as little as it must, toward upright, for its drawing to keep inside the column at the end
 * of the day, whether in bloom or gone to seed; or null if no turn keeps it in. The binding tilts what it
 * pinches, and a leaf leaning out over the column's edge is turned back into it.
 */
function fitted(item: MotifItem, W: number, H: number): MotifItem | null {
  const stages: readonly Stage[] = item.staged ? ["bloom", "seed"] : ["bloom"];
  const points = stages.flatMap(stage => item.draw(createRng(item.seed), item.size, stage)).flatMap(shape =>
    shape.type === "body" ? [...shape.outline, ...shape.veins.flat()] : shape.type === "solid" ? shape.outline : shape.points);
  const towards = ((90 - item.angle) % 360 + 540) % 360 - 180;
  for (let step = 0; step <= 6; step += 1) {
    const angle = item.angle + Math.sign(towards) * Math.min(Math.abs(towards), step * 8);
    const c = Math.cos((angle - 90) * RAD), s = Math.sin((angle - 90) * RAD);
    const inside = points.every(([x, y]) => {
      const px = item.at[0] + x * c - y * s, py = item.at[1] + x * s + y * c;
      return px >= -0.45 && px <= W + 0.45 && py >= 0.05 && py <= H - 0.05;
    });
    if (inside) return step === 0 ? item : { ...item, angle };
  }
  return null;
}

/** The items in a random order, shuffled in place. */
function shuffle<T>(rng: Rng, items: T[]): T[] {
  for (let k = items.length - 1; k > 0; k -= 1) {
    const j = rng.int(0, k);
    [items[k], items[j]] = [items[j]!, items[k]!];
  }
  return items;
}

/** The x of a centreline rising in y at height `y`, held at its end beyond either end. */
function xAt(points: readonly Pt[], y: number): number {
  const first = points[0]!, last = points[points.length - 1]!;
  if (y <= first[1]) return first[0];
  if (y >= last[1]) return last[0];
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1]!, b = points[index]!;
    if (b[1] >= y) return b[1] === a[1] ? b[0] : lerp(a[0], b[0], (y - a[1]) / (b[1] - a[1]));
  }
  return last[0];
}

/** A stalk's cut face where it stands on the ground: a small oval across its end, with the pith in a thick one. */
function cutFace(rng: Rng, at: Pt, angle: number, w: number): Shape[] {
  const rx = w * 0.55, ry = w * 0.24;
  const face: Body = { type: "body", outline: turn(circle([0, 0], rx, ry, 12), angle, at), shadow: [], grain: [], veins: [], weight: 0.3 };
  if (w > 0.06) face.veins.push(turn(circle([rng.sym(rx * 0.15), 0], rx * 0.3, ry * 0.35, 8), angle, at));
  return [face];
}

/**
 * The tie: a cord of twisted straw wound round the waist, drawn as the front of its turns. Each turn sags a
 * little in the middle, as a ring seen from just above does, and is a row of strands laid slantwise, each
 * overlapping the one before, lit from the upper left and cut with a line or two in its shade. The ends are
 * twisted together on one side and tucked under, with a few straws standing out of the twist.
 */
function tie(rng: Rng, girth: number, sideOf: 1 | -1): Shape[] {
  const shapes: Shape[] = [];
  const reach = girth / 2;
  const bow = 0.035 + girth * 0.03;
  const pitch = ROPE * 0.5;
  for (let k = 0; k < TURNS; k += 1) {
    const lift = (k - (TURNS - 1) / 2) * ROPE * 0.9;
    const sag = bow * rng.range(0.85, 1.15);
    const yAt = (x: number): number => lift - sag * (1 - (x / reach) ** 2);
    const count = Math.max(4, Math.round(girth / pitch));
    for (let j = 0; j <= count; j += 1) {
      const x = -reach + girth * j / count + rng.sym(pitch * 0.08);
      // The turn runs round out of sight at the edges, so its strands narrow there.
      const edge = 1 - 0.35 * smoothstep(0.75, 1, Math.abs(x) / reach);
      const slope = Math.atan(2 * sag * x / (reach * reach));
      shapes.push(strand(rng, [x, yAt(x)], 56 * RAD + slope, ROPE * 0.64 * edge, ROPE * 0.3));
    }
  }
  // The twist where the ends are tucked under: strands set the other way across both turns.
  const knot = sideOf * reach * rng.range(0.35, 0.6);
  for (let j = 0; j < 3; j += 1) {
    shapes.push(strand(rng, [knot + sideOf * (j - 1) * pitch * 0.8, ROPE * (j - 1) * 0.5 - bow * 0.6], -56 * RAD, ROPE * 0.7, ROPE * 0.34));
  }
  for (let j = 0; j < 4; j += 1) {
    const a = (sideOf > 0 ? 0 : Math.PI) + sideOf * rng.range(-0.9, 0.7);
    const from: Pt = [knot + rng.sym(pitch), rng.sym(ROPE * 0.5) - bow * 0.6];
    const length = rng.range(0.18, 0.38);
    shapes.push(line([from, [from[0] + Math.cos(a) * length * 0.5, from[1] + Math.sin(a) * length * 0.5 + rng.sym(0.02)],
      [from[0] + Math.cos(a) * length, from[1] + Math.sin(a) * length]], 0.011));
  }
  return shapes;
}

/** One strand of the cord: a lens laid at `angle`, `a` along and `b` across, shaded on its lower right. */
function strand(rng: Rng, at: Pt, angle: number, a: number, b: number): Body {
  const outline = sample(v => {
    const t = v * Math.PI * 2;
    return [Math.cos(t) * a, Math.sin(t) * b * (0.75 + 0.25 * Math.abs(Math.cos(t)))] as Pt;
  }, 14).slice(0, -1);
  const shadow: Pt[] = [[-a * 1.5, -b * 0.1], [a * 1.5, -b * 0.1], [a * 1.5, -b * 3], [-a * 1.5, -b * 3]];
  const grain: Pt[][] = [-0.45, -0.75].map(v => {
    const along = a * Math.sqrt(1 - v * v) * rng.range(0.7, 0.85);
    return [[-along, v * b], [along, v * b]];
  });
  return { type: "body", outline: turn(outline, angle, at), shadow: [turn(shadow, angle, at)], grain: grain.map(cut => turn(cut, angle, at)), veins: [], weight: 0.55 };
}

/** The ground the sheaf stands on: level strokes of shadow under its foot, broken more the further they lie from it. */
function ground(rng: Rng, centre: number, spread: number): Shape[] {
  const strokes: Shape[] = [];
  for (let k = 0; k < 3; k += 1) {
    const reach = spread * (1.15 - 0.25 * k) + rng.sym(0.08);
    const y = FOOT - 0.04 - k * HATCH * 1.2;
    const dashes = 1 + k;
    for (let j = 0; j < dashes; j += 1) {
      const x0 = centre - reach + 2 * reach * (j + rng.range(0, 0.15)) / dashes, x1 = centre - reach + 2 * reach * (j + rng.range(0.7, 0.95)) / dashes;
      strokes.push(line([[x0, y + rng.sym(0.01)], [lerp(x0, x1, 0.5), y + rng.sym(0.012)], [x1, y + rng.sym(0.01)]], 0.012));
    }
  }
  return strokes;
}

export const festival: FestivalModule = { id: "travail", grow };
