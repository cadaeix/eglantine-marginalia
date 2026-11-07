// Leaves drawn by their outline, and the acorn: the feuillage form's broadleaf drawing, which the festival
// of Rewards also braids into its civic crown of oak. They live apart from the kit every form shares, so a page
// that draws neither carries none of them. Primitives draw in their own frame, origin at the base and axis +y.
import type { Stage } from "./form.js";
import { bezier3, type Pt, sample, smoothstep, unit } from "./geometry.js";
import { circle, HATCH, line, turnShape } from "./kit.js";
import type { Rng } from "./random.js";
import { bladeBody, type Body, roundBody, type Shape } from "./shapes.js";

/** A direction rotated by `a` radians. */
export const rot = (d: Pt, a: number): Pt => [d[0] * Math.cos(a) - d[1] * Math.sin(a), d[0] * Math.sin(a) + d[1] * Math.cos(a)];
/** The point `k` times the direction `d` along from `p`. */
export const add = (p: Pt, d: Pt, k = 1): Pt => [p[0] + d[0] * k, p[1] + d[1] * k];
/** The unit tangent of a curve at `v`, from two points either side of it. */
export function tangent(c: (v: number) => Pt, v: number): Pt {
  const a = c(Math.max(0, v - 0.01)), b = c(Math.min(1, v + 0.01));
  return unit(b[0] - a[0], b[1] - a[1]);
}
/** A closed outline symmetric about the axis, from its half-width along the length. */
export function profile(len: number, hw: (v: number) => number, base = 0, n = 24): Pt[] {
  const right: Pt[] = sample(v => [hw(v), base + len * v], n);
  const left: Pt[] = right.slice().reverse().map(([x, y]) => [-x, y]);
  return [...right, ...left].filter((p, i, all) => i === 0 || Math.hypot(p[0] - all[i - 1]![0], p[1] - all[i - 1]![1]) > 1e-4);
}
/** An ellipse turned by `angle` (radians, from +y), for nuts, seeds and berries. */
export const oval = (at: Pt, rx: number, ry: number, angle = 0, n = 14): Pt[] => circle([0, 0], rx, ry, n).map(p => add(at, rot(p, -angle)));
/** A nut or seed: an ellipse shaded as a round body. */
export const nut = (at: Pt, rx: number, ry: number, angle: number, weight: number): Body => roundBody(oval(at, rx, ry, angle), at, Math.max(rx, ry), HATCH * 0.55, weight);
/** Dots of ink: stamens, seeds, a tip's scar. */
export const dots = (points: Pt[], radius: number): Shape => ({ type: "dots", points, radius });

/** A simple leaf by its outline (see LEAF_OUTLINES), its breadth as a share of its length, its margin, and whether its base is lopsided. */
export interface LeafSpec { leaf: string; width: number; margin: string; asymmetric: boolean }

/** The margin as a perturbation of the half-width: teeth lean toward the tip. */
function marginEdge(margin: string, length: number, asymmetric: boolean, width: number): (v: number, side: 1 | -1) => number {
  const n = Math.max(7, Math.round(length / 0.075));
  const d = length * 0.022;
  const tooth = (v: number): number => {
    const f = (v * n) % 1;
    switch (margin) {
      case "serrate": return -d * f;
      case "double": return -d * 1.2 * f - d * 0.5 * ((v * n * 3) % 1);
      case "crenate": return -d * (1 - Math.sin(Math.PI * f));
      case "wavy": return d * 0.7 * Math.sin(Math.PI * 2 * v * n / 2);
      default: return 0;
    }
  };
  return (v, side) => {
    const fade = Math.min(1, v / 0.1) * Math.min(1, (1 - v) / 0.06);
    // An elm's leaf is lopsided at the base: one side starts lower and wider.
    const lop = asymmetric ? side * length * width * 0.12 * (1 - v) ** 4 : 0;
    return tooth(v) * fade + lop;
  };
}

/**
 * The half-width envelopes of the simple leaf outlines, roughly 1 at their widest; `drop` lets the base reach
 * below the petiole. The broadleaf trees draw their leaves from them, and the civic crown its oak leaves.
 */
export const LEAF_OUTLINES: Readonly<Record<string, { o: (v: number) => number; drop: number; petiole: number }>> = {
  ovate: { o: v => Math.sin(Math.PI * v ** 0.75) ** 0.85, drop: 0, petiole: 0.12 },
  elliptic: { o: v => Math.sin(Math.PI * v) ** 0.85, drop: 0, petiole: 0.1 },
  round: { o: v => v ** 0.35 * (1 - v ** 4) ** 0.5, drop: 0, petiole: 0.14 },
  heart: { o: v => v < 0.16 ? 0.12 + 0.83 * Math.sqrt(v / 0.16) : 0.95 * Math.sin(Math.PI * (0.5 + 0.5 * (v - 0.16) / 0.84)) ** 0.75 * (1 - 0.2 * smoothstep(0.8, 1, v)) + 0.05 * (1 - v), drop: 0.2, petiole: 0.2 },
  triangle: { o: v => Math.sin(Math.PI / 2 * Math.min(1, v / 0.24)) ** 0.8 * (1 - v) ** 1.1 * 1.15, drop: 0.03, petiole: 0.22 },
  spoon: { o: v => Math.max(0.12, Math.sqrt(Math.max(0, 1 - ((v - 0.7) / 0.3) ** 2))), drop: 0, petiole: 0.05 },
  arrow: { o: v => v < 0.2 ? Math.min(1, v / 0.03) * 0.85 * (1 - 0.35 * (0.2 - v) / 0.2) : 0.85 * ((1 - v) / 0.8) ** 0.8, drop: 0.2, petiole: 0.3 },
  lanceolate: { o: v => Math.sin(Math.PI * v ** 0.9), drop: 0, petiole: 0.06 },
  oblong: { o: v => (1 - (2 * v - 1) ** 8) ** 0.35 * Math.min(1, v / 0.12) ** 0.5, drop: 0, petiole: 0.02 },
  lettuce: { o: v => v ** 0.4 * (1 - v ** 3) ** 0.5, drop: 0, petiole: 0.02 },
  chard: { o: v => Math.sin(Math.PI * v ** 0.8) ** 0.7, drop: 0.02, petiole: 0.28 },
  rhubarb: { o: v => Math.sin(Math.PI * (0.12 + 0.88 * v) ** 0.85) ** 0.55, drop: 0.14, petiole: 0.34 },
  brassica: { o: v => (0.3 + 0.7 * v ** 0.7) * (1 - v ** 4) ** 0.5 * (v < 0.45 ? 0.45 + 0.55 * Math.abs(Math.sin(Math.PI * v * 5)) ** 0.7 : 1), drop: 0, petiole: 0.12 },
  oak: { o: v => Math.sin(Math.PI * v ** 0.8) ** 0.7 * (0.52 + 0.48 * Math.abs(Math.sin(Math.PI * (v * 5 + 0.15))) ** 0.6) * (v < 0.07 ? 1.6 : 1), drop: 0.02, petiole: 0.05 },
  cut: { o: v => (0.3 + 0.9 * v ** 1.5) * (1 - v) ** 0.35 * (v < 0.72 ? 0.22 + 0.78 * (1 - (v * 5) % 1) ** 1.6 : 1), drop: 0, petiole: 0.04 },
};

/** A simple leaf: an outlined blade on its petiole, with midrib and straight secondary veins; a `light` leaflet keeps only its midrib. */
export function outlineLeaf(rng: Rng, length: number, bend: number, spec: LeafSpec, weight = 0.5, light = false): Shape[] {
  const shape = LEAF_OUTLINES[spec.leaf] ?? LEAF_OUTLINES.ovate!;
  const petiole = length * shape.petiole;
  const L = length - petiole;
  const y0 = petiole - shape.drop * L;
  const spine = (v: number): Pt => [bend * L * v * v, y0 + L * v];
  const halfWidth = (v: number): number => Math.max(0.004, shape.o(v) * spec.width * 0.5 * L);
  const edge = marginEdge(spec.margin, L, spec.asymmetric, spec.width);
  const veins: Pt[][] = [];
  // Small leaflets keep only their midrib, so a compound leaf stays light.
  const crinkled = ["lettuce", "brassica", "rhubarb", "chard"].includes(spec.leaf);
  const count = light || L < 0.6 ? 0 : Math.max(3, Math.round(L / (crinkled ? 0.28 : 0.2)));
  for (let k = 1; k < count; k += 1) {
    const v = k / count * 0.88 + 0.04;
    const reach = Math.min(0.98, v + 0.09);
    const t = tangent(spine, reach);
    for (const side of [1, -1] as const) {
      const end = add(spine(reach), [-t[1] * side, t[0] * side], (halfWidth(reach) + Math.min(0, edge(reach, side))) * 0.85);
      veins.push(crinkled
        ? sample(bezier3(spine(v), add(spine(v), [-t[1] * side, t[0] * side], halfWidth(v) * 0.4), add(end, [0, -L * 0.04]), end), 3)
        : [spine(v), end]);
    }
  }
  const body = bladeBody({ spine, halfWidth, edge, shade: bend >= 0 ? 1 : -1, spacing: HATCH * (L < 0.6 ? 1.4 : 1), grain: "across", weight, midrib: true, veins,
    samples: Math.round(Math.min(48, Math.max(light ? 10 : 14, L * 26))) }, rng);
  // A leaflet of a compound leaf is too small to be worth cutting in shade.
  if (light) { body.grain = []; body.shadow = []; }
  const shapes: Shape[] = [line([[0, 0], [0, Math.max(petiole, y0 + L * 0.05)]], Math.max(0.012, length * 0.016))];
  if (spec.leaf === "chard" || spec.leaf === "rhubarb" || spec.leaf === "brassica") {
    // The thick pale midrib and stalk the crop is grown for.
    const rib = bladeBody({ spine: v => [bend * L * (v * 0.7) ** 2, (y0 + L * 0.7) * v], halfWidth: v => length * 0.03 * (1 - 0.6 * v), shade: 1, spacing: HATCH, grain: "along", reach: [0.2, 0.5], weight: 0.25, samples: 14 }, rng);
    return [shapes[0]!, body, rib];
  }
  shapes.push(body);
  return shapes;
}

// ---------------------------------------------------------------- fruit

/**
 * An acorn at `at`, its axis turned by `angle` radians from +y: a cup of overlapping scales with the nut seated
 * in it (chêne, liège), the nut longer and darker at `stage` "seed". `shaggy` fringes the cup's rim, as the
 * cork oak's is; a `fallen` acorn has left its cup.
 */
export function acorn(rng: Rng, at: Pt, angle: number, r: number, stage: Stage, shaggy: boolean, fallen = false): Shape[] {
  const ripe = stage === "seed";
  const shapes: Shape[] = [];
  const nutLen = r * (ripe ? 1.5 : 1.25);
  if (!fallen) {
    const cup = roundBody(profile(r * 0.75, v => r * 0.62 * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, v * 0.7 + 0.3))), 0, 12), [0, r * 0.4], r * 0.6, HATCH * 0.5, 0.75);
    cup.veins = [0.25, 0.5, 0.75].map(f => sample(u => [(u * 2 - 1) * r * 0.58, r * 0.75 * f + Math.abs(Math.sin(u * Math.PI * 4)) * r * 0.08], 12));
    if (shaggy) shapes.push(...[-1, -0.5, 0, 0.5, 1].map(q => line([[q * r * 0.6, r * 0.7], [q * r * 0.95, r * 0.95]], r * 0.06)));
    shapes.push(turnShape(cup, -angle, at));
  }
  const body = nut([0, r * 0.55 + nutLen * 0.45], r * 0.5, nutLen * 0.5, 0, ripe ? 0.75 : 0.4);
  shapes.unshift(turnShape(body, -angle, at), turnShape(dots([[0, r * 0.55 + nutLen * 0.95]], r * 0.07), -angle, at));
  return shapes;
}
