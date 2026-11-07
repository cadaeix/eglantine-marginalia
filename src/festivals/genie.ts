// The festival of Genius, which Fabre d'Églantine gave to "tout ce qui tient à l'invention & aux opérations
// créatrices de l'esprit humain": a cut quill planted in the earth as a garden stake, and the plant twining
// up it. The garden is the plant's own, grown by the loop with its leaves, branches and blooms, but its main
// stems wind round the quill's bare shaft, passing in front of it and behind it in turn, and leave it where
// the vanes begin to finish their height free. A plant that grows out of a foot of its own, such as a root
// study, has the quill pushed into that ground at its crown, the cut nib showing in the section; a plant with
// no stems, such as l'amadouvier's stump, has it pushed into the ground behind. Any other plant stands it in a
// mound of earth, and a fruit that leaves a husk, as the chestnut leaves its burr, stands it in the empty husk:
// "la plume plantée dans la bogue". The quill is there from dawn; time brings the plant up it as it brings
// stems on any day, and fullness, which counts the words written, brings the leaves.
import type { FestivalContext, FestivalModule } from "../festival.js";
import { type Foot, LAYER } from "../form.js";
import type { Garden, GardenItem, MotifItem, StemItem } from "../garden.js";
import { arcLength, bezier3, clamp, lerp, type Pt, RAD, sample, smoothstep } from "../geometry.js";
import { HATCH, line } from "../kit.js";
import { createRng, noise1, type Rng } from "../random.js";
import type { Body, Shape } from "../shapes.js";

/**
 * The quill lies over the stems behind it, and the stems' crossings in front of it over the quill; with no
 * stems it stands behind the plant's foot, which is drawn at 1.8.
 */
const QUILL_LAYER = 2.05, POT_LAYER = 2.08, FRONT_LAYER = 2.1, BEHIND_LAYER = 1.7;
/** Where the soil line of a mound or husk lies, in centimetres above the paper's foot. */
const SOIL = 0.3;
/** The quill's top, as a share of the column's height. */
const REACH = 0.63;
/** Shares of the quill's length: the barrel, and the stripped shaft below the vanes. */
const BARREL = 0.17, VANES = 0.5;
/** The vanes' widths at most, in centimetres: the narrow outer vane and the broad inner one. */
const NARROW = 0.42, BROAD = 0.7;
/** The empty husk's width and the mound's, in centimetres. */
const HUSK_WIDTH = 2.3, MOUND_WIDTH = 2.6;

function grow(context: FestivalContext): Garden {
  const { form, rng, width: W, height: H, spec } = context;
  const mirrored = spec.page?.side === "right";
  const lean = rng.sym(2.5);
  const broad: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  const bow = broad * rng.range(0.2, 0.4);
  const lambda = rng.range(2.2, 2.8), phase = rng.range(0, 2 * Math.PI);
  const away: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  const sways = Array.from({ length: form.stems.count }, () => noise1(rng));
  const quillSeed = Math.floor(rng.u() * 4294967295), potSeed = Math.floor(rng.u() * 4294967295);

  // What the quill stands in: the plant's own foot, or a husk or mound drawn over the quill's buried end.
  let pot: { draw: MotifItem["draw"]; size: number; name: string; at: number } | null = null;
  let foot: Foot;
  let base: number, clear: number, share: number;
  if (form.foot) {
    foot = form.foot;
    base = Math.max(0.05, foot.crown[1] - 0.8);
    clear = foot.crown[1] + 0.4;
    share = foot.crown[0];
    // With no stems to twine round it, the quill stands behind what the foot draws, a little to the side of
    // its crown where the column is wider, as a stake pushed into the ground behind a stump.
    if (form.stems.count === 0) share = clamp(share + (share < 0.5 ? 1 : -1) * 1.5 / W, 1 / W, 1 - 1 / W);
  } else {
    let top: number, half: number, crown: number;
    if (form.husk) {
      // The husk is measured once, so it stands at the width wanted whatever its form draws, its stalk on the
      // soil line; a little earth heaped round its foot hides the stalk.
      const husk = form.husk;
      const bounds = extent(husk(createRng(potSeed), 1));
      const size = HUSK_WIDTH / (bounds[2] - bounds[0]);
      const bottom = SOIL + Math.max(0, bounds[1]) * size, height = (bounds[3] - Math.max(0, bounds[1])) * size;
      pot = { draw: (r, s) => [...husk(r, s), ...mound(r, HUSK_WIDTH * 0.72)], size, name: "husk", at: SOIL };
      top = bottom + height; half = HUSK_WIDTH / 2; crown = bottom + height * 0.55; base = bottom + height * 0.45;
    } else {
      const height = MOUND_WIDTH * 0.22;
      pot = { draw: mound, size: MOUND_WIDTH, name: "earth", at: SOIL };
      top = SOIL + height; half = MOUND_WIDTH / 2; crown = SOIL + height * 0.7; base = SOIL + height * 0.3;
    }
    clear = top + 0.1;
    foot = { crown: [0.5, crown], room: [[0.5 - (half + 0.1) / W, 0, 0.5 + (half + 0.1) / W, top]], scroll: false, draw: ground };
    share = 0.5;
  }
  const length = (clamp(H * REACH, base + 6, H - 0.4) - base) / Math.cos(lean * RAD);
  // The quill's axis in the layout before a right-hand page is mirrored: it leans by `lean` degrees towards -x.
  const rootX = W * (mirrored ? 1 - share : share);
  const axis = (y: number): number => rootX - (y - base) * Math.tan(lean * RAD);
  const bare = base + length * (VANES - 0.04) * Math.cos(lean * RAD);
  const radius = 0.24 + form.stems.width * 0.6;

  // Main stem k winds round the shaft as a helix seen from the side, its turns offset from the other stems',
  // to the top of the bare shaft; there it leaves the quill for one side and sways free to its top. Where it
  // comes round in front of the shaft is marked, to be drawn again over the quill.
  const fronts: boolean[][] = [];
  const mains = (k: number, root: Pt, top: number): Pt[] => {
    const offset = phase + 2 * Math.PI * k / Math.max(1, form.stems.count);
    const side = (k % 2 === 0 ? away : -away) * (1.4 + 0.4 * Math.floor(k / 2));
    const sway = sways[k]!;
    const points: Pt[] = [], front: boolean[] = [];
    for (let y = root[1]; y <= top; y += y < bare ? 0.2 : 0.25) {
      const turn = 2 * Math.PI * (y - root[1]) / lambda + offset;
      const free = smoothstep(bare, bare + 2.2, y);
      const wind = radius * smoothstep(root[1], root[1] + 0.8, y) * (1 - free);
      const x = axis(y) + wind * Math.sin(turn) + free * (side + 0.35 * sway(y / 3));
      points.push([clamp(x, 0.8, W - 0.8), y]);
      front.push(y > clear && free === 0 && Math.cos(turn) > 0);
    }
    fronts[k] = front;
    return points;
  };
  const garden = context.grow({ form: form.foot ? form : { ...form, foot }, mains });
  const x = mirrored ? garden.width - rootX : rootX;
  const angle = mirrored ? 90 - lean : 90 + lean;

  // The loop knows nothing of the quill, and would hang fruit and flowers over its vanes. Those that would
  // hide the feather are taken off with the branches that bore them, before the garden is shown: the
  // stems still pass behind the vanes and the leaves over them, as a vine's do on its stake.
  const dx = Math.cos(angle * RAD), dy = Math.sin(angle * RAD), flip = mirrored ? -1 : 1;
  const rows = new Map(form.motifs.map(row => [row.name, row]));
  const key = (p: Pt): string => `${p[0]},${p[1]}`;
  const hidden = new Set<string>();
  for (const item of garden.items) {
    const row = item.kind === "motif" ? rows.get(item.name) : undefined;
    if (item.kind !== "motif" || !row || item.layer <= LAYER.leaf) continue;
    const r = row.r(item.size), off = row.off(item.size);
    const cx = item.at[0] + Math.cos(item.angle * RAD) * off - x, cy = item.at[1] + Math.sin(item.angle * RAD) * off - base;
    const along = cx * dx + cy * dy, across = flip * broad * (cx * dy - cy * dx);
    if (along > length * VANES - r * 0.5 && along < length + r * 0.3 && across > -(NARROW + 0.12 + r * 0.7) && across < BROAD + 0.12 + Math.abs(bow) + r * 0.7) {
      hidden.add(key(item.at));
    }
  }
  // A branch that bore a hidden bloom goes with it, and so does any branch leaving it, and what that bore.
  const cut = new Set<string>();
  const branches = garden.items.filter((item): item is StemItem => item.kind === "stem" && !item.main);
  for (let changed = true; changed;) {
    changed = false;
    for (const item of branches) {
      const end = key(item.points[item.points.length - 1]!);
      if (cut.has(key(item.points[1] ?? item.points[0]!)) || !(hidden.has(end) || cut.has(key(item.points[0]!)))) continue;
      for (const p of item.points.slice(1)) cut.add(key(p));
      hidden.add(end);
      changed = true;
    }
  }
  const items: GardenItem[] = garden.items.filter(item => item.kind === "stem"
    ? item.main || !cut.has(key(item.points[item.points.length - 1]!))
    : !hidden.has(key(item.at)) && !cut.has(key(item.at)));
  let order = Math.max(0, ...items.map(item => item.order)) + 1;
  items.push({ kind: "motif", order: order++, layer: form.stems.count === 0 ? BEHIND_LAYER : QUILL_LAYER, name: "quill", at: [x, base], angle, size: length, seed: quillSeed,
    born: 0, staged: false, seedAt: 2, leafRank: null, draw: (r, s) => quill(r, s, broad, bow) });
  if (pot) {
    items.push({ kind: "motif", order: order++, layer: POT_LAYER, name: pot.name, at: [x, pot.at], angle: 90, size: pot.size, seed: potSeed,
      born: 0, staged: false, seedAt: 2, leafRank: null, draw: pot.draw });
  }
  // Each run of a main stem in front of the shaft is drawn again over the quill, as wide as the stem is there
  // and growing over the part of the morning the stem takes to grow through it, so the two keep in step.
  const mainItems = garden.items.filter((item): item is StemItem => item.kind === "stem" && item.main);
  mainItems.forEach((item, k) => {
    const front = fronts[k] ?? [];
    const { at, total } = arcLength(item.points);
    if (total <= 0) return;
    for (let start = 0; start < front.length; start += 1) {
      if (!front[start]) continue;
      let end = start;
      while (end + 1 < front.length && front[end + 1]) end += 1;
      const a = Math.max(0, start - 1), b = Math.min(item.points.length - 1, end + 1);
      const ua = at[a]! / total, ub = at[b]! / total;
      items.push({ kind: "stem", order: order++, layer: FRONT_LAYER, main: false, points: item.points.slice(a, b + 1),
        w0: lerp(item.w0, item.w1, ua), w1: lerp(item.w0, item.w1, ub),
        born: lerp(item.born, item.grown, ua), grown: lerp(item.born, item.grown, ub) });
      start = end;
    }
  });
  return { ...garden, items };
}

/** The bounds of what shapes draw, as [x0, y0, x1, y1]. */
function extent(shapes: Shape[]): [number, number, number, number] {
  const box: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const shape of shapes) {
    const points = shape.type === "body" ? [...shape.outline, ...shape.veins.flat()] : shape.type === "solid" ? shape.outline : shape.points;
    for (const [px, py] of points) {
      box[0] = Math.min(box[0], px); box[1] = Math.min(box[1], py);
      box[2] = Math.max(box[2], px); box[3] = Math.max(box[3], py);
    }
  }
  return box;
}

/**
 * A goose quill cut for writing, `s` long, drawn upright from the point of its nib. The nib is cut in a
 * scoop to a slit point, showing the hollow of the barrel; the barrel and the stripped shaft above it are
 * bare, shaded down their right side as a cylinder; the upper half keeps its vanes, a broad one on the side
 * `broad` and a narrow one opposite, their barbs cut as fine strokes and parted here and there where the
 * feather has split. The shaft bows a little towards the broad vane, by `bow` centimetres at its tip.
 */
function quill(rng: Rng, s: number, broad: 1 | -1, bow: number): Shape[] {
  const nib = 0.85, barrel = s * BARREL, start = s * VANES;
  const spine = (y: number): number => bow * (y / s) ** 2;
  const shaft = (y: number): number => y < barrel ? 0.16 : lerp(0.135, 0.024, ((y - barrel) / (s - barrel)) ** 1.15);
  // Face on, the scoop narrows the barrel in two shoulders to the point.
  const half = (y: number): number => shaft(y) * (0.05 + 0.95 * smoothstep(0, nib, y) ** 0.75);
  const ys = [...sample(v => [0, nib * 1.2 * v], 24).map(p => p[1]), ...sample(v => [0, lerp(nib * 1.2, s, v)], 60).slice(1).map(p => p[1])];
  const outline: Pt[] = [...ys.map((y): Pt => [spine(y) - half(y), y]), ...ys.slice().reverse().map((y): Pt => [spine(y) + half(y), y])];
  // The hollow of the cut barrel shows below an arch; the shaft is shaded down its right side above it.
  const arch = (q: number): number => nib * (0.5 + 0.42 * q * q);
  const hollow: Pt[] = sample(v => {
    const q = -1 + 2 * v;
    return [spine(arch(q)) + q * half(arch(q)) * 1.3, arch(q)];
  }, 12);
  const hollowRing: Pt[] = [...hollow, [0.4, nib * 0.95], [0.4, -0.2], [-0.4, -0.2], [-0.4, nib * 0.95]];
  const bandFrom = nib * 1.05;
  const band: Pt[] = [...ys.filter(y => y >= bandFrom).map((y): Pt => [spine(y) + half(y) * 0.2, y]),
    ...ys.filter(y => y >= bandFrom).reverse().map((y): Pt => [spine(y) + half(y) + 0.3, y])];
  const grain: Pt[][] = [];
  for (const q of [0.35, 0.55, 0.72, 0.88]) {
    grain.push(ys.filter(y => y >= bandFrom && y < s * (0.97 - 0.25 * (1 - q))).map((y): Pt => [spine(y) + half(y) * q, y]));
  }
  for (let y = 0.04; y < nib; y += HATCH * 0.7) grain.push([[-0.3, y - 0.03], [0.3, y + 0.03]]);
  const veins: Pt[][] = [
    // The slit up from the point, and the arch where the scoop's cut meets the whole barrel.
    [[spine(0), 0.02], [spine(nib * 0.42), nib * 0.42]],
    hollow,
    // Where the barrel gives way to the shaft, and the groove down the shaft's underside.
    sample(v => [spine(barrel) + (-1 + 2 * v) * shaft(barrel) * 0.9, barrel + 0.04 * Math.sin(Math.PI * v)], 6),
    ys.filter(y => y > barrel + 0.1 && y < s * 0.93).map((y): Pt => [spine(y) - half(y) * 0.3, y]),
  ];
  const body: Body = { type: "body", outline, shadow: [hollowRing, band], grain, veins, weight: 0.55 };

  const shapes: Shape[] = [vane(rng, s, start, -broad, NARROW, true, spine, half), vane(rng, s, start, broad, BROAD, false, spine, half)];
  // A few barbs the stripping missed, ragged below the vanes.
  for (const side of [-1, 1] as const) {
    for (let k = 0; k < 4; k += 1) {
      const y = start - rng.range(0.05, 0.9);
      const reach = rng.range(0.12, 0.35) * (side === broad ? 1.3 : 0.8);
      const from: Pt = [spine(y) + side * half(y) * 0.8, y];
      const a = rng.range(40, 70) * RAD;
      shapes.push(line(sample(bezier3(from, [from[0] + side * reach * 0.5, y + reach * 0.1],
        [from[0] + side * reach * Math.sin(a) * 0.9, y + reach * Math.cos(a) * 0.6], [from[0] + side * reach * Math.sin(a), y + reach * Math.cos(a)]), 4), 0.007));
    }
  }
  shapes.push(body);
  return shapes;
}

/**
 * One vane of the quill on the side `side`, from the height `start` to the tip, `wide` centimetres across at
 * most. Its barbs leave the shaft leaning towards the tip and curve a little as they reach the edge, which
 * notches where the barbs have parted. A dark vane is shaded all over, a light one only near the shaft.
 */
function vane(rng: Rng, s: number, start: number, side: number, wide: number, dark: boolean,
  spine: (y: number) => number, half: (y: number) => number): Body {
  const splits = Array.from({ length: rng.int(2, 4) }, () => ({ at: rng.range(0.15, 0.85), depth: rng.range(0.25, 0.55) }));
  const width = (y: number): number => {
    const u = clamp((y - start) / (s - start), 0, 1);
    let w = wide * smoothstep(0, 0.2, u) ** 0.8 * Math.max(0, 1 - u ** 3.5) ** 0.45;
    for (const split of splits) w *= 1 - split.depth * Math.exp(-(((u - split.at) / 0.014) ** 2));
    return w;
  };
  const edge = (y: number, share = 1): Pt => [spine(y) + side * (half(y) + width(y) * share), y];
  const ys = sample(v => [0, lerp(start, s, v)], 160).map(p => p[1]);
  const outline: Pt[] = [...ys.map((y): Pt => [spine(y), y]), ...ys.slice().reverse().map(y => edge(y))];
  const lean = Math.tan(rng.range(48, 56) * RAD);
  const barbs = (from: number, every: number): Pt[][] => {
    const cuts: Pt[][] = [];
    for (let y = from; y < s; y += every) {
      const w = width(y), end = Math.min(y + w * lean, s - 0.03);
      if (w < 0.02 || end <= y) continue;
      const a: Pt = [spine(y) + side * half(y) * 0.9, y], b = edge(end, 0.98);
      const reach = Math.abs(b[0] - a[0]);
      cuts.push(sample(bezier3(a, [a[0] + side * reach * 0.45, y + (end - y) * 0.12], [b[0] - side * reach * 0.2, end - (end - y) * 0.15], b), 4));
    }
    return cuts;
  };
  const every = 0.042;
  const shade: Pt[] = dark ? outline : [...ys.map((y): Pt => [spine(y), y]), ...ys.slice().reverse().map(y => edge(y, 0.4))];
  return { type: "body", outline, shadow: [shade], grain: barbs(start + every / 2, every), veins: barbs(start, every), weight: dark ? 0.4 : 0.3 };
}

/** A low mound of earth `s` wide, its clods shaded on the right and a few stones in it. */
function mound(rng: Rng, s: number): Shape[] {
  const h = s * 0.22;
  const clods = noise1(rng);
  const top: Pt[] = sample(v => {
    const q = -1 + 2 * v;
    return [q * s / 2, Math.max(0, h * (1 - q * q) ** 0.8 + 0.035 * clods(v * 9) * (1 - q * q))];
  }, 36);
  const outline: Pt[] = [...top, [s / 2, -0.02], [-s / 2, -0.02]];
  const shade: Pt[] = [[s * 0.08, h * 1.5], [s, h * 1.5], [s, -0.1], [-s * 0.1, -0.1], [-s * 0.3, h * 0.25]];
  const grain: Pt[][] = [];
  for (let k = -20; k <= 20; k += 1) {
    const x0 = k * HATCH * 1.1;
    grain.push([[x0 - h, -0.05], [x0 + h * 0.6, h * 1.2]]);
  }
  const veins: Pt[][] = [];
  for (let k = 0; k < 6; k += 1) {
    const cx = rng.range(-0.38, 0.38) * s, cy = rng.range(0.15, 0.6) * h * (1 - (2 * cx / s) ** 2);
    const r = rng.range(0.04, 0.09);
    veins.push(sample(v => [cx + Math.cos(Math.PI * (0.1 + 0.9 * v)) * r * 1.4, cy + Math.sin(Math.PI * (0.1 + 0.9 * v)) * r], 6));
  }
  return [{ type: "body", outline, shadow: [shade], grain, veins, weight: 0.5 }];
}

/** The soil line the quill's pot stands on: a stroke along the ground and shorter ones under it, as an engraver lays them. */
function ground(rng: Rng, column: { width: number; height: number }): Shape[] {
  const cx = column.width / 2;
  const wobble = rng.range(0, 3);
  const shapes: Shape[] = [line(sample(v => [cx + lerp(-1.75, 1.8, v), SOIL + 0.02 * Math.sin(v * 7 + wobble)], 10), 0.014)];
  for (let k = 1; k <= 4; k += 1) {
    const y = SOIL - k * 0.06, reach = 1.5 - k * 0.3;
    const x0 = cx + rng.sym(0.2) - reach;
    shapes.push(line([[x0, y], [x0 + reach * 2 * rng.range(0.85, 1), y + rng.sym(0.01)]], 0.009));
  }
  return shapes;
}

export const festival: FestivalModule = { id: "genie", grow };
