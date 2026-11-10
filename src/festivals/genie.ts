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
//
// In a bandeau the quill stands in the middle of the bed, in a smaller pot, and the plant there twines up it while
// the rest of the bed leans a little towards it. In a cul-de-lampe it stands at the spray's one root: every stem
// winds up its shaft, the outer ones leaving it lowest to arch out to the sides, and the middle one goes on to the
// vanes. A band's quill reaches the top of its plants, and its vanes are narrowed to its shorter length.
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
/** In a band, génie keeps its pot no taller than this share of the band's height, so the band shows it whole on its foot. */
const BAND_POT = 0.22;
/** In a band, génie winds its stems this much more tightly, to make a turn or two on the short shaft before they leave it. */
const BAND_TURN = 0.45;
/** Where génie stands a bed's plants on bare ground, the quill's among them. */
const BED_ROOT = 0.5;
/** In a band, each stem's twining starts this far round the shaft from the one before: the golden angle, so any number of them spread evenly. */
const GOLDEN = Math.PI * (3 - Math.sqrt(5));

/** The quill as it stands: its nib's place, its length, how high its shaft is bare, and above what height stems cross in front of it. */
interface Stake { x: number; base: number; length: number; bare: number; clear: number }

function grow(context: FestivalContext): Garden {
  const { form, rng, width: W, height: H, spec, ornament } = context;
  const mirrored = spec.page?.side === "right";
  const bed = ornament === "bandeau";
  const lean = rng.sym(2.5);
  const broad: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  const bow = broad * rng.range(0.2, 0.4);
  const lambda = rng.range(2.2, 2.8) * (ornament ? BAND_TURN : 1), phase = rng.range(0, 2 * Math.PI);
  const away: 1 | -1 = rng.chance(0.5) ? 1 : -1;
  // A band lays more main stems than the plant has; the sways of the stems past the plant's own are drawn as they come.
  const sways = Array.from({ length: form.stems.count }, () => noise1(rng));
  const swayOf = (k: number): (x: number) => number => sways[k] ??= noise1(rng);
  const quillSeed = Math.floor(rng.u() * 4294967295), potSeed = Math.floor(rng.u() * 4294967295);
  const { footWidth } = context;

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
    // its crown where the column is wider, as a stake pushed into the ground behind a stump. A band places it
    // once it knows where it has drawn the foot.
    if (form.stems.count === 0 && !ornament) share = clamp(share + (share < 0.5 ? 1 : -1) * 1.5 / W, 1 / W, 1 - 1 / W);
  } else {
    let top: number, half: number, crown: number;
    if (form.husk) {
      // The husk is measured once, so it stands at the width wanted whatever its form draws, its stalk on the
      // soil line; a little earth heaped round its foot hides the stalk. A band draws it smaller if it must.
      const husk = form.husk;
      const bounds = extent(husk(createRng(potSeed), 1));
      const across = bounds[2] - bounds[0], tall = bounds[3] - Math.max(0, bounds[1]);
      const size = ornament ? Math.min(HUSK_WIDTH / across, H * BAND_POT / tall) : HUSK_WIDTH / across;
      const wide = ornament ? size * across : HUSK_WIDTH;
      const bottom = SOIL + Math.max(0, bounds[1]) * size, height = tall * size;
      pot = { draw: (r, s) => [...husk(r, s), ...mound(r, wide * 0.72)], size, name: "husk", at: SOIL };
      top = bottom + height; half = wide / 2; crown = bottom + height * 0.55; base = bottom + height * 0.45;
    } else {
      const height = MOUND_WIDTH * 0.22;
      pot = { draw: mound, size: MOUND_WIDTH, name: "earth", at: SOIL };
      top = SOIL + height; half = MOUND_WIDTH / 2; crown = SOIL + height * 0.7; base = SOIL + height * 0.3;
    }
    clear = top + 0.1;
    // A bed's plants stand on bare ground, the quill's among them, its root hidden in the pot drawn over it, and
    // the bed's outer plants curl their roots as they would on any day.
    if (bed) crown = BED_ROOT;
    foot = { crown: [0.5, crown], room: [[0.5 - (half + 0.1) / footWidth, 0, 0.5 + (half + 0.1) / footWidth, top]], scroll: bed, draw: ground };
    share = 0.5;
  }
  const cos = Math.cos(lean * RAD);
  /** The quill with its nib at (x, nib) and `length` long. */
  const stake = (x: number, nib: number, length: number, above: number): Stake => ({ x, base: nib, length, bare: nib + length * (VANES - 0.04) * cos, clear: above });
  // In a band the quill is placed once the garden gives its plant a root, as deep below it as the foot puts it,
  // and reaches the top of the band's plants.
  const settle = (x: number, nib: number): Stake => stake(x, nib, (context.ground - nib) / cos, nib + clear - base);
  // In the column the quill stands where the foot puts it, in the layout before a right-hand page is mirrored, and
  // leans by `lean` degrees towards -x.
  let stood: Stake | null = ornament ? null : stake(W * (mirrored ? 1 - share : share), base, (clamp(H * REACH, base + 6, H - 0.4) - base) / cos, clear);
  const radius = 0.24 + form.stems.width * 0.6;

  /** A stem of a bed that does not climb the quill: it rises from its root with a little sway, leaning towards the quill. */
  const beside = (k: number, j: number, root: Pt, top: number): Pt[] => {
    const sway = swayOf(k);
    const toward = (share * footWidth - root[0]) / W * 0.2, apart = j === 0 ? 0 : root[0] < share * footWidth ? -0.3 : 0.3;
    const points: Pt[] = [];
    for (let y = root[1]; y <= top; y += 0.25) {
      const rise = y - root[1];
      const x = root[0] + toward * rise + apart * smoothstep(0, 1.2, rise) + 0.4 * (sway(y / 2) - sway(root[1] / 2)) * smoothstep(0, 1.5, rise);
      points.push([clamp(x, 0.5, W - 0.5), y]);
    }
    return points;
  };
  // Main stem k winds round the shaft as a helix seen from the side, its turns offset from the other stems',
  // to the top of the bare shaft; there it leaves the quill for one side and sways free to its top. Where it
  // comes round in front of the shaft is marked, to be drawn again over the quill. A cul-de-lampe's side stems,
  // those the loop arches out to the sides, leave the shaft lower the further out the loop takes them, and from
  // there run into the loop's own arch to its tip.
  const fronts: boolean[][] = [];
  const counted = new Map<number, number>();
  const mains = (k: number, root: Pt, top: number, laid: readonly Pt[]): Pt[] => {
    const j = counted.get(root[0]) ?? 0;
    counted.set(root[0], j + 1);
    // The quill's plant is the one on the foot's crown: in a bed, one of several; in a cul-de-lampe, its only one.
    // Its nib goes as deep below the root as the foot puts it, but no deeper than the band's foot.
    if (!stood && (!bed || Math.abs(root[0] - share * footWidth) < 1e-6)) stood = settle(root[0], Math.max(0.05, root[1] - (foot.crown[1] - base)));
    if (!stood || Math.abs(root[0] - stood.x) > 1e-6 && bed) {
      fronts[k] = [];
      return beside(k, j, root, top);
    }
    const q = stood;
    const axis = (y: number): number => q.x - (y - q.base) * Math.tan(lean * RAD);
    const offset = ornament ? phase + GOLDEN * j : phase + 2 * Math.PI * k / Math.max(1, form.stems.count);
    const side = (j % 2 === 0 ? away : -away) * ((ornament ? 1.7 : 1.4) + 0.4 * Math.floor(j / 2));
    const sway = swayOf(k);
    const tip = laid[laid.length - 1] ?? root;
    const out = Math.abs(tip[0] - root[0]);
    const arching = ornament === "cul-de-lampe" && out > 1;
    const leave = arching ? lerp(q.bare - 0.4, root[1] + 1, clamp(out / (W * 0.35), 0, 1)) : Infinity;
    const edge = ornament ? 0.5 : 0.8;
    const points: Pt[] = [], front: boolean[] = [];
    for (let y = root[1]; y <= Math.min(top, leave); y += y < q.bare ? 0.2 : 0.25) {
      const turn = 2 * Math.PI * (y - root[1]) / lambda + offset;
      const free = smoothstep(q.bare, q.bare + (ornament ? 1.2 : 2.2), y);
      const wind = radius * smoothstep(root[1], root[1] + 0.8, y) * (1 - free);
      const x = axis(y) + wind * Math.sin(turn) + free * (side + 0.35 * sway(y / 3));
      points.push([clamp(x, edge, W - edge), y]);
      front.push(y > q.clear && free === 0 && Math.cos(turn) > 0);
    }
    if (arching && points.length > 0) {
      // From where it leaves the shaft it eases into the loop's arch, where that rises past the same height, and
      // follows it to its tip.
      const from = points[points.length - 1]!;
      const start = Math.max(1, laid.findIndex(p => p[1] >= from[1]));
      const rest = laid.slice(start);
      const { at, total } = arcLength(rest);
      const ease = Math.min(1.5, total * 0.5);
      const dx = from[0] - rest[0]![0], dy = from[1] - rest[0]![1];
      rest.forEach(([px, py], index) => {
        const keep = 1 - smoothstep(0, ease, at[index]!);
        points.push([clamp(px + dx * keep, edge, W - edge), py + dy * keep]);
        front.push(false);
      });
    }
    fronts[k] = front;
    return points;
  };
  const garden = context.grow({ form: form.foot ? form : { ...form, foot }, mains });
  // A band places a quill with no stems to climb it once the garden has drawn the foot, which the band may have
  // shrunk or lowered. The stump fills the band's height, so a quill behind it would be lost: it stands clear
  // beside the forms the foot raises above its crown, on the side with more room, or in front of the stump if
  // there is none.
  const drawn = garden.foot!;
  let layer = form.stems.count === 0 ? BEHIND_LAYER : QUILL_LAYER;
  if (!stood) {
    const raised = drawn.draw(createRng(drawn.seed), { width: drawn.width, height: (H + drawn.drop) / drawn.scale }, 1, 1)
      .filter(shape => shape.type === "body" && Math.max(...shape.outline.map(p => p[1])) > foot.crown[1] + 0.3);
    const box = extent(raised);
    const x0 = drawn.x + box[0] * drawn.scale, x1 = drawn.x + box[2] * drawn.scale;
    const beyond = W - x1 >= x0 ? x1 + 0.5 : x0 - 0.5;
    const clearOf = beyond > 0.8 && beyond < W - 0.8;
    if (!clearOf) layer = QUILL_LAYER;
    stood = settle(clearOf ? beyond : drawn.x + share * drawn.width * drawn.scale + (share < 0.5 ? 1.2 : -1.2), base * drawn.scale - drawn.drop);
  }
  const q: Stake = stood;
  const x = mirrored ? garden.width - q.x : q.x;
  const angle = mirrored ? 90 - lean : 90 + lean;
  // A band's shorter quill has narrower vanes and a slighter bow.
  const wide = ornament ? clamp(q.length / 11, 0.55, 1) : 1;
  const bent = bow * wide;
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
    const cx = item.at[0] + Math.cos(item.angle * RAD) * off - x, cy = item.at[1] + Math.sin(item.angle * RAD) * off - q.base;
    const along = cx * dx + cy * dy, across = flip * broad * (cx * dy - cy * dx);
    if (along > q.length * VANES - r * 0.5 && along < q.length + r * 0.3 && across > -(NARROW * wide + 0.12 + r * 0.7) && across < BROAD * wide + 0.12 + Math.abs(bent) + r * 0.7) {
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
  items.push({ kind: "motif", order: order++, layer, name: "quill", at: [x, q.base], angle, size: q.length, seed: quillSeed,
    born: 0, staged: false, seedAt: 2, leafRank: null, draw: (r, s) => quill(r, s, broad, bent, wide) });
  if (pot) {
    items.push({ kind: "motif", order: order++, layer: POT_LAYER, name: pot.name, at: [x, pot.at * drawn.scale - drawn.drop], angle: 90, size: pot.size * drawn.scale, seed: potSeed,
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
 * feather has split. The shaft bows a little towards the broad vane, by `bow` centimetres at its tip, and the vanes
 * are `wide` times their usual widths.
 */
function quill(rng: Rng, s: number, broad: 1 | -1, bow: number, wide: number): Shape[] {
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

  const shapes: Shape[] = [vane(rng, s, start, -broad, NARROW * wide, true, spine, half), vane(rng, s, start, broad, BROAD * wide, false, spine, half)];
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
