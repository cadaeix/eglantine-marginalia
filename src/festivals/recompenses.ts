// The festival of Rewards: the civic crown. Rome gave a crown of oak leaves to the citizen who had saved a
// citizen's life, and the Revolution took the corona civica back as the nation's reward; here it is
// woven of oak and of the year's plant. Two branches cross and are tied at the foot of a ring in the upper
// middle of the column, and sweep up either side until their tips nearly meet at the top. Along each, the
// leaves point to its tip, one angled outward and one inward at every node, and oak alternates with the
// plant's own leaf, so the two are braided; acorns and the plant's fruit are tucked in among them. A ribbon
// ties the knot, its loops spread and its two ends hanging, striped with the accent ink of a cockade.
//
// A cul-de-lampe holds the crown as the column does, its ribbon's ends hanging to the tailpiece's point. A
// bandeau hangs a festoon from each side of the crown, braided the same way, sagging across the band and
// caught up at its top corners by a bow of the same ribbon, as Louis XVI headpieces hang their garlands.
//
// The ribbon is there from dawn. The branches grow round from the knot through the morning, and their
// leaves and fruit come as each branch passes; the fruit ripens towards evening, as a chestnut's burr
// splits. Fullness brings the leaves in an order spread round the ring, so a quiet day shows a thin crown
// all round, never a full half of one.
import type { FestivalContext, FestivalModule } from "../festival.js";
import { LAYER, type Stage } from "../form.js";
import type { Garden, GardenItem, MotifItem } from "../garden.js";
import { arcLength, bezier3, lerp, normals, type Pt, RAD, sample, smoothstep } from "../geometry.js";
import { circle, HATCH, line } from "../kit.js";
import { acorn, outlineLeaf } from "../leaves.js";
import { createRng, type Rng } from "../random.js";
import { type Body, roundBody, type Shape } from "../shapes.js";

/** The ring's radius along the branches, in centimetres, for the 6 cm column; leaves reach about 0.7 beyond it. */
const RING = 1.75;
/** Where the branches begin and end, in degrees from +x: the left one starts right of the knot and ends left of the top. */
const START = -68, END = -255;
/** Leaves stand about this far apart along a branch. */
const NODE = 0.4;
/** The moment the branches have grown round. */
const GROWN = 0.5;
/** The leaves lie just over the plant's leaf layer, so they keep the ranks given here; fruit and the ribbon lie over them. */
const LEAVES = LAYER.leaf + 0.1, FRUIT = LAYER.bloom, RIBBON = LAYER.bloom + 0.5;
/** Shares of a branch's length where fruit is tucked in: the plant's, then acorns. */
const FRUITS = [0.3, 0.56, 0.8], ACORNS = [0.43, 0.68, 0.92];
const OAK = { leaf: "oak", width: 0.6, margin: "entire", asymmetric: false } as const;

type Draw = (rng: Rng, s: number, stage: Stage) => Shape[];

/**
 * How far a leaf reaches along its axis, to either side of it and back behind its base, drawn at length 1:
 * the most of a few draws, since some plants' leaves vary from one draw to the next.
 */
function reach(leaf: (rng: Rng, length: number, bend: number) => Shape[]): { along: number; across: number; below: number } {
  let along = 0, across = 0, below = 0;
  for (let k = 1; k <= 5; k += 1) {
    for (const shape of leaf(createRng(k), 1, 0)) {
      const points = shape.type === "body" || shape.type === "solid" ? shape.outline : shape.points;
      for (const [x, y] of points) { along = Math.max(along, y); below = Math.min(below, y); across = Math.max(across, Math.abs(x)); }
    }
  }
  return { along, across, below };
}

/**
 * The plant's leaf for the crown, drawn so that it reaches about `s` along its axis. A leaf that spreads wider
 * than it is long or reaches back past its base (a palmate leaf, a compound one, a sprig) gives way to its
 * leaflet; if that is no better, the leaf is drawn smaller, so that it spreads no wider than a leaf would.
 */
function plantLeaf(context: FestivalContext): (rng: Rng, s: number, bend: number) => Shape[] {
  const { form } = context;
  const odd = (m: { along: number; across: number; below: number }): boolean => m.along < 0.3 || m.across > 0.6 * m.along || m.below < -0.1 * m.along;
  const leaf = reach(form.leaf), leaflet = reach(form.leaflet);
  const [draw, m] = odd(leaf) && !odd(leaflet) ? [form.leaflet, leaflet] : [form.leaf, leaf];
  const scale = 1 / Math.max(0.3, m.along, m.across / 0.5, m.along - m.below);
  return (rng, s, bend) => draw(rng, s * scale, bend);
}

/** The plant's fruit or bloom for the crown, and the size it is drawn at: its first staged bloom, or what ends its stems. */
function plantFruit(context: FestivalContext): { draw: Draw; size: number } {
  const { form } = context;
  const row = form.motifs.find(motif => motif.staged && motif.layer === LAYER.bloom);
  const [draw, radius] = row ? [row.draw, row.r(1)] : [form.terminal.draw, form.terminal.r(1)];
  return { draw, size: Math.min(1.2, Math.max(0.3, 0.3 / Math.max(0.05, radius))) };
}

/** Two or three acorns on a short stalk, as they are tucked into a civic crown; they are small and pale at first, and darken as they ripen. */
const acorns: Draw = (rng, s, stage) => {
  const stalk = s * 0.3;
  const shapes: Shape[] = [line([[0, 0], [rng.sym(0.04) * s, stalk * 0.5], [0, stalk]], s * 0.03)];
  const r = s * (stage === "bud" ? 0.15 : 0.21);
  const count = rng.chance(0.6) ? 2 : 3;
  for (let k = 0; k < count; k += 1) {
    const a = (k - (count - 1) / 2) * 0.8 + rng.sym(0.1);
    shapes.push(...acorn(rng, [Math.sin(a) * r * 0.3, stalk + Math.cos(a) * r * 0.3], a, r, stage, false));
  }
  return shapes;
};

/** One end of the ribbon hanging from the knot on side `hand`, twisting as it falls and cut in a swallowtail. */
function streamer(rng: Rng, hand: 1 | -1, length: number): Shape[] {
  const n = 56;
  const sway = rng.range(0.75, 1.0);
  const curve = bezier3([0, 0], [hand * 0.2, -length * 0.2], [hand * sway, -length * 0.5], [hand * (sway - 0.25), -length]);
  const centre = sample(v => { const [x, y] = curve(v); return [x + hand * 0.12 * Math.sin(v * Math.PI * 2.2), y]; }, n);
  const normal = normals(centre);
  // The ribbon leaves the knot face up and turns over once as it falls, so its cut end shows the back.
  const twist = rng.range(-0.15, 0.05);
  const turn = (k: number): number => Math.cos(Math.PI * (twist + 1.15 * k / n));
  const half = (k: number): number => 0.2 * (0.25 + 0.75 * Math.abs(turn(k)));
  const edge = (k: number, q: number): Pt => [centre[k]![0] + normal[k]![0] * half(k) * q, centre[k]![1] + normal[k]![1] * half(k) * q];
  const left = centre.map((_, k) => edge(k, 1)), right = centre.map((_, k) => edge(k, -1));
  const tip = centre[n]!, back = centre[n - 3]!;
  const notch: Pt = [tip[0] + (back[0] - tip[0]) * 1.6, tip[1] + (back[1] - tip[1]) * 1.6];
  const outline = [...left, notch, ...right.reverse()];
  // Where the ribbon has turned, its back shows, and is cut across in shade.
  const shadow: Pt[][] = [];
  let run: number[] = [];
  for (let k = 0; k <= n + 1; k += 1) {
    if (k <= n && turn(k) < 0) { run.push(k); continue; }
    if (run.length > 1) shadow.push([...run.map(j => edge(j, 1.4)), ...run.reverse().map(j => edge(j, -1.4))]);
    run = [];
  }
  const grain = centre.slice(0, n - 1).map((_, k) => [edge(k, 1.3), edge(k + 2, -1.3)]);
  const band: Body = { type: "body", outline, shadow, grain, veins: [], weight: 0.45 };
  // A stripe down the middle, cut in fine lines of the accent ink, as a cockade's red runs down a white ribbon.
  const stripe = [-0.3, -0.1, 0.1, 0.3].map(q => line(centre.slice(1, n - 2).map((_, k) => edge(k + 1, q)), 0.016, true, "accent"));
  return [band, ...stripe];
}

/** One loop of the bow on side `hand`: a teardrop of ribbon round an opening in shadow, with the red stripe running round it. */
function loop(rng: Rng, hand: 1 | -1): Shape[] {
  const tip = rng.range(0.85, 1.0), lift = rng.range(0.25, 0.4);
  const upper = bezier3([0, 0.07], [hand * 0.25, 0.5 + lift * 0.3], [hand * tip * 0.85, 0.45 + lift], [hand * tip, lift]);
  const lower = bezier3([hand * tip, lift], [hand * tip * 1.05, lift - 0.3], [hand * 0.45, -0.25], [0, -0.07]);
  const outline = [...sample(upper, 16), ...sample(lower, 16).slice(1)];
  const middle: Pt = [hand * tip * 0.58, lift * 0.62 + 0.06];
  const toward = (share: number): Pt[] => outline.map(([x, y]): Pt => [lerp(middle[0], x, share), lerp(middle[1], y, share * 0.9)]);
  const opening = toward(0.62);
  const grain: Pt[][] = [];
  for (let k = -16; k <= 16; k += 1) grain.push([[hand * (0.5 + k * 0.036) - 0.6, -0.4], [hand * (0.5 + k * 0.036) + 0.6, 1.2]]);
  const band: Body = { type: "body", outline, shadow: [opening], grain, veins: [[...opening, opening[0]!]], weight: 0.7 };
  const stripe = [0.77, 0.86].map(share => { const ring = toward(share); return line([...ring, ring[0]!], 0.016, true, "accent"); });
  return [band, ...stripe];
}

/** The bow at the knot, drawn about the knot's centre: the hanging ends behind, about `3 s` long, then the loops, and the knot over them. */
const bow: Draw = (rng, s) => {
  const shapes: Shape[] = [...streamer(rng, -1, s * 3.0), ...streamer(rng, 1, s * rng.range(2.6, 2.9)), ...loop(rng, -1), ...loop(rng, 1)];
  const knot = roundBody(circle([0, 0], 0.17, 0.2, 14), [0, 0], 0.2, HATCH * 0.6, 0.55);
  knot.veins = [sample(v => [-0.08 + 0.16 * v, -0.12 + 0.05 * Math.sin(v * Math.PI)], 5), sample(v => [-0.09 + 0.18 * v, 0.1 - 0.04 * Math.sin(v * Math.PI)], 5)];
  shapes.push(knot);
  return shapes;
};

/** The leaves' ranks as fullness brings them: each node's pair together, the nodes visited in an order that spreads them round the ring. */
function spread(count: number): number[] {
  const order: number[] = [];
  for (let k = 0; k < count; k += 1) {
    // The van der Corput sequence in base 2, scaled to the count: each new node falls in the largest gap left.
    let x = 0, f = 0.5;
    for (let i = k + 1; i > 0; i >>= 1, f /= 2) if (i & 1) x += f;
    order.push(x);
  }
  const ranks = new Array<number>(count);
  order.map((x, k) => [x, k] as const).sort((a, b) => a[0] - b[0]).forEach(([, k], position) => { ranks[k] = position; });
  return ranks;
}

/**
 * A braided branch and its mirror: `path` is one branch in its own frame, from its cut end to its tip, set on
 * the paper at `origin` and mirrored about it for the other. `toward` moves a point on the path to its
 * outer side (a factor over 1) or its inner side (under 1), the outer side being left of the way it runs. Its
 * leaves begin `first` of the way along it.
 */
interface Braid { path: Pt[]; origin: Pt; scale: number; first: number; toward: (at: Pt, heading: number, factor: number) => Pt }

/** Lays a braid's two branches, the leaves along them, the leaf at each tip and the fruit tucked among them. */
function braid(rng: Rng, leaf: (rng: Rng, s: number, bend: number) => Shape[], fruit: { draw: Draw; size: number }, b: Braid): GardenItem[] {
  const { path, origin, scale, first, toward } = b;
  const seed = (): number => Math.floor(rng.u() * 4294967295);
  const { at: lengths, total } = arcLength(path);
  const pointAt = (share: number): { at: Pt; heading: number } => {
    const goal = share * total;
    let k = 1;
    while (k < path.length - 1 && lengths[k]! < goal) k += 1;
    const a = path[k - 1]!, c = path[k]!;
    const f = (goal - lengths[k - 1]!) / Math.max(1e-9, lengths[k]! - lengths[k - 1]!);
    return { at: [lerp(a[0], c[0], f), lerp(a[1], c[1], f)], heading: Math.atan2(c[1] - a[1], c[0] - a[0]) / RAD };
  };
  const bornAt = (share: number): number => Math.min(GROWN, share * GROWN + 0.015);
  const place = (p: Pt, hand: 1 | -1): Pt => [origin[0] + hand * p[0], origin[1] + p[1]];
  const turnHeading = (heading: number, hand: 1 | -1): number => hand === 1 ? heading : 180 - heading;

  const stems: GardenItem[] = [], leaves: MotifItem[] = [], fruits: GardenItem[] = [];
  for (const hand of [1, -1] as const) {
    stems.push({ kind: "stem", order: 0, layer: LAYER.stem, main: false, points: path.map(p => place(p, hand)), w0: 0.075 * scale, w1: 0.018 * scale, born: 0, grown: GROWN });
  }
  // The leaves begin just past the cut end and stand closer and smaller towards the tips.
  const nodes = Math.floor(total * (1 - first) / NODE);
  const ranks = spread(nodes);
  for (let k = 0; k < nodes; k += 1) {
    const share = first + (1 - first) * (k + 0.5) / nodes;
    const { at, heading } = pointAt(share);
    const taper = 1 - 0.45 * smoothstep(0.75, 1, share);
    // The node is laid alike on both branches, so the braid stays symmetric as it fills; only the draws differ.
    // The plant's leaf is drawn a little longer than the oak's, as a chestnut's is, so the two read apart.
    const outward = rng.range(28, 38), inward = rng.range(18, 26);
    const oakLength = rng.range(0.92, 1.02), plantLength = rng.range(1.08, 1.22);
    for (const hand of [1, -1] as const) {
      for (const inner of [true, false]) {
        // Oak and the plant alternate along the branch, and across each node.
        const oak = (k % 2 === 0) === inner;
        const spreadAngle = inner ? -inward : outward;
        const size = (oak ? oakLength : plantLength) * (inner ? 0.9 : 1) * taper * scale;
        const bend = (inner ? 0.12 : 0.06) * hand;
        const base = toward(at, heading, inner ? 0.985 : 1.015);
        leaves.push({
          kind: "motif", order: 0, layer: LEAVES, name: oak ? "oak" : "leaf", at: place(base, hand),
          angle: turnHeading(heading + spreadAngle, hand), size, seed: seed(), born: bornAt(share), staged: false, seedAt: 2,
          leafRank: (ranks[k]! * 2 + (inner ? 1 : 0)) / (nodes * 2),
          draw: oak ? (r, s) => outlineLeaf(r, s, bend, OAK) : (r, s) => leaf(r, s, bend),
        });
      }
    }
  }
  // Each branch ends in a single leaf of the plant along its line.
  const tip = pointAt(1), tipLength = rng.range(0.6, 0.7) * scale;
  for (const hand of [1, -1] as const) {
    const bend = 0.1 * hand;
    leaves.push({
      kind: "motif", order: 0, layer: LEAVES, name: "leaf", at: place(tip.at, hand), angle: turnHeading(tip.heading + 6, hand), size: tipLength,
      seed: seed(), born: GROWN, staged: false, seedAt: 2, leafRank: 0, draw: (r, s) => leaf(r, s, bend),
    });
  }
  // Fruit and acorns sit among the leaves at the outer edge, pointing out and a little towards the tip.
  for (const [shares, draw, size, name] of [[FRUITS, fruit.draw, fruit.size, "fruit"], [ACORNS, acorns, 0.75, "acorns"]] as const) {
    for (const share of shares) {
      const { at, heading } = pointAt(share);
      const tilt = rng.range(-35, -15);
      for (const hand of [1, -1] as const) {
        fruits.push({
          kind: "motif", order: 0, layer: FRUIT, name, at: place(toward(at, heading, 0.96), hand),
          angle: turnHeading(heading + 90 + tilt, hand), size: size * scale, seed: seed(), born: bornAt(share) + 0.02, staged: true, seedAt: 2, leafRank: null, draw,
        });
      }
    }
  }
  return [...stems, ...leaves, ...fruits];
}

function grow(context: FestivalContext): Garden {
  const { rng, width: W, height: H } = context;
  const scale = Math.min(1, W / 6);
  const radius = RING * scale;
  const centre: Pt = [W / 2, Math.min(context.ground - radius - 0.9 * scale, H * 0.6)];
  const leaf = plantLeaf(context);
  const fruit = plantFruit(context);
  // The left branch's line, from its cut end right of the knot round to its tip left of the top; the right one is its mirror.
  const path = sample(u => {
    const a = lerp(START, END, u) * RAD;
    const r = radius * (1 + 0.1 * (1 - smoothstep(0, 0.16, u)));
    return [Math.cos(a) * r, Math.sin(a) * r];
  }, 80);
  const crown = braid(rng, leaf, fruit, { path, origin: centre, scale, first: 0.15, toward: (at, _heading, factor) => [at[0] * factor, at[1] * factor] });
  // The ribbon's ends hang about 3 cm, or less in a column too short for them.
  const knot: Pt = [centre[0], centre[1] - radius * 1.06];
  const hang = Math.max(0.1, Math.min(scale, (knot[1] - 0.3) / 3));
  const ribbon: MotifItem = { kind: "motif", order: 0, layer: RIBBON, name: "ribbon", at: knot, angle: 90, size: hang, seed: Math.floor(rng.u() * 4294967295), born: 0, staged: false, seedAt: 2, leafRank: null, draw: bow };
  if (context.ornament !== "bandeau") return context.compose([...crown, ribbon]);

  // A bandeau's festoons: each runs from a bow at a top corner of the band, sags across it and rises to slip its
  // tip into the crown's side, so its leaves point to the crown. Its bow's loops reach about a centimetre to
  // either side of the knot and above it.
  const corner: Pt = [W / 2 - 1.25, H - 1.1];
  const side: Pt = [radius + 0.35, centre[1] + 0.25];
  const low = (11.2 - corner[1] - side[1]) / 6;
  const swag = sample(bezier3(corner, [corner[0] - (corner[0] - side[0]) * 0.15, low], [side[0] + (corner[0] - side[0]) * 0.35, low], side), 60);
  const festoons = braid(rng, leaf, fruit, {
    path: swag, origin: [W / 2, 0], scale: scale * 0.85, first: 0.05,
    toward: (at, heading, factor) => [at[0] + Math.cos((heading + 90) * RAD) * (factor - 1) * RING, at[1] + Math.sin((heading + 90) * RAD) * (factor - 1) * RING],
  });
  const bows = ([1, -1] as const).map((hand): MotifItem => ({
    kind: "motif", order: 0, layer: RIBBON, name: "ribbon", at: [W / 2 + hand * corner[0], corner[1] + 0.1], angle: 90, size: 0.3, seed: Math.floor(rng.u() * 4294967295),
    born: 0, staged: false, seedAt: 2, leafRank: null, draw: bow,
  }));
  return context.compose([...crown, ribbon, ...festoons, ...bows]);
}

export const festival: FestivalModule = { id: "recompenses", grow };
