// Plane geometry for the margin garden, after florilegium's ink.lua (Kevin Raymond, MIT). Units are
// centimetres with y pointing up; the renderer flips the page once at the end.

export type Pt = [number, number];

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const clamp = (value: number, low: number, high: number): number => Math.min(high, Math.max(low, value));
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}
export const distance = (a: Pt, b: Pt): number => Math.hypot(a[0] - b[0], a[1] - b[1]);
/** Whether a point lies inside a polygon, by the even-odd rule. */
export function inside([x, y]: Pt, poly: readonly Pt[]): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i, i += 1) {
    const [xi, yi] = poly[i]!, [xj, yj] = poly[j]!;
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
export function unit(x: number, y: number): Pt {
  const length = Math.hypot(x, y);
  return length < 1e-9 ? [0, 1] : [x / length, y / length];
}
export const degrees = (x: number, y: number): number => Math.atan2(y, x) * 180 / Math.PI;
export const RAD = Math.PI / 180;

/** Left-hand unit normals of a polyline. */
export function normals(points: readonly Pt[]): Pt[] {
  return points.map((_, index) => {
    const a = points[Math.max(0, index - 1)]!, b = points[Math.min(points.length - 1, index + 1)]!;
    const [x, y] = unit(b[0] - a[0], b[1] - a[1]);
    return [-y, x];
  });
}

/** Cumulative arc length at each point, and the total. */
export function arcLength(points: readonly Pt[]): { at: number[]; total: number } {
  const at = [0];
  let total = 0;
  for (let index = 1; index < points.length; index += 1) {
    total += distance(points[index]!, points[index - 1]!);
    at.push(total);
  }
  return { at, total };
}

/** The first `fraction` of a polyline by length, ending exactly at that fraction. */
export function prefix(points: readonly Pt[], fraction: number): Pt[] {
  if (fraction >= 1) return points.slice();
  if (fraction <= 0 || points.length < 2) return points.slice(0, 1);
  const { at, total } = arcLength(points);
  const target = total * fraction;
  const out: Pt[] = [points[0]!];
  for (let index = 1; index < points.length; index += 1) {
    if (at[index]! >= target) {
      const span = at[index]! - at[index - 1]!;
      const t = span > 1e-9 ? (target - at[index - 1]!) / span : 0;
      const a = points[index - 1]!, b = points[index]!;
      out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t)]);
      return out;
    }
    out.push(points[index]!);
  }
  return out;
}

/** A closed outline around a centreline whose full width at fraction u is width(u). */
export function ribbon(points: readonly Pt[], width: (u: number) => number): Pt[] {
  const normal = normals(points);
  const { at, total } = arcLength(points);
  const left: Pt[] = [], right: Pt[] = [];
  points.forEach((point, index) => {
    const half = width(total > 0 ? at[index]! / total : 0) / 2;
    const [nx, ny] = normal[index]!;
    left.push([point[0] + nx * half, point[1] + ny * half]);
    right.push([point[0] - nx * half, point[1] - ny * half]);
  });
  return [...left, ...right.reverse()];
}

/** Samples of a curve f(v) at n + 1 evenly spaced parameters from v0 to v1. */
export function sample(curve: (v: number) => Pt, n: number, v0 = 0, v1 = 1): Pt[] {
  return Array.from({ length: n + 1 }, (_, index) => curve(v0 + (v1 - v0) * index / n));
}

export function bezier3(p0: Pt, p1: Pt, p2: Pt, p3: Pt): (v: number) => Pt {
  return v => {
    const u = 1 - v;
    const a = u * u * u, b = 3 * u * u * v, c = 3 * u * v * v, d = v * v * v;
    return [a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0], a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1]];
  };
}

/**
 * A blade: a closed outline around a spine with half-widths left(v) and right(v), and an optional
 * edge perturbation along the normal. Petals, leaves, sepals and buds are blades.
 */
export function blade(spine: (v: number) => Pt, n: number, left: (v: number) => number, right: (v: number) => number,
  edge?: (v: number, side: 1 | -1) => number): { outline: Pt[]; centre: Pt[] } {
  const centre = sample(spine, n);
  const normal = normals(centre);
  const leftSide: Pt[] = [], rightSide: Pt[] = [];
  centre.forEach((point, index) => {
    const v = index / n;
    const a = Math.max(0, left(v) + (edge ? edge(v, 1) : 0));
    const b = Math.max(0, right(v) + (edge ? edge(v, -1) : 0));
    const [nx, ny] = normal[index]!;
    leftSide.push([point[0] + nx * a, point[1] + ny * a]);
    rightSide.push([point[0] - nx * b, point[1] - ny * b]);
  });
  return { outline: [...leftSide, ...rightSide.slice(1, -1).reverse()], centre };
}

const trim = (text: string): string => text.includes(".") ? text.replace(/0+$/, "").replace(/\.$/, "") : text;
/** A number in an SVG attribute: a hundredth of a centimetre is finer than a pixel at screen sizes. */
export const num = (value: number): string => trim(value.toFixed(2));
/** A stroke width or radius, which can be finer than any coordinate. */
export const fine = (value: number): string => trim(value.toFixed(4));

// Path data is written in hundredths of a centimetre, finer than a pixel at screen sizes. Each subpath
// starts at an absolute point and steps from point to point in relative commands, so most numbers are
// small; the steps are taken between rounded points, so rounding never drifts along a path.

/** A whole number of hundredths written as briefly as path data allows: "3", "-1.2", ".05". */
function hundredths(value: number): string {
  const magnitude = Math.abs(value);
  const whole = Math.trunc(magnitude / 100), part = magnitude % 100;
  const sign = value < 0 ? "-" : "";
  if (part === 0) return `${sign}${whole}`;
  return `${sign}${whole === 0 ? "" : whole}.${part < 10 ? `0${part}` : part % 10 === 0 ? part / 10 : part}`;
}

// Most relative steps fit within a centimetre. Their spellings are shared by every path rather than allocated
// again for every coordinate of every dot, hatch and curve.
const SMALL_STEP = 100;
const smallHundredths = Array.from({ length: 2 * SMALL_STEP + 1 }, (_, index) => hundredths(index - SMALL_STEP));

/** Writes rounded coordinates directly, without temporary point and command arrays. */
class PathData {
  text = "";
  #first = true;
  #dotted = false;

  command(command: string): void {
    this.text += command;
    this.#first = true;
  }

  pair(x: number, y: number): void {
    this.#number(x);
    this.#number(y);
  }

  #number(value: number): void {
    const text = value >= -SMALL_STEP && value <= SMALL_STEP ? smallHundredths[value + SMALL_STEP]! : hundredths(value);
    if (!this.#first && text[0] !== "-" && !(text[0] === "." && this.#dotted)) this.text += " ";
    this.text += text;
    this.#first = false;
    this.#dotted = value % 100 !== 0;
  }
}

/** A straight polyline or polygon as SVG path data. */
export function polyPath(points: readonly Pt[], closed = false): string {
  if (points.length === 0) return "";
  const path = new PathData();
  let x = Math.round(points[0]![0] * 100), y = Math.round(points[0]![1] * 100);
  path.command("M");
  path.pair(x, y);
  if (points.length > 1) {
    path.command("l");
    for (let index = 1; index < points.length; index += 1) {
      const point = points[index]!;
      const nx = Math.round(point[0] * 100), ny = Math.round(point[1] * 100);
      path.pair(nx - x, ny - y);
      x = nx; y = ny;
    }
  }
  return closed ? `${path.text}z` : path.text;
}

/**
 * Points as path data for a round-capped stroke to draw as dots: each is a subpath of no length. The first is
 * placed absolutely and each after it is stepped to from the one before, so most numbers are small.
 */
export function pointsPath(points: readonly Pt[]): string {
  const path = new PathData();
  let x = 0, y = 0;
  for (const point of points) {
    const nx = Math.round(point[0] * 100), ny = Math.round(point[1] * 100);
    path.command(path.text === "" ? "M" : "m");
    path.pair(nx - x, ny - y);
    path.command("h0");
    x = nx; y = ny;
  }
  return path.text;
}

/**
 * A smooth curve through the points (Catmull-Rom as cubic Béziers) as SVG path data. A Catmull-Rom curve's
 * control points mirror each other about every point it passes through, so each segment after the first is
 * written with the `s` shorthand, which mirrors the last control point; each tangent is rounded once, so
 * the mirroring holds exactly in hundredths.
 */
export function smoothPath(points: readonly Pt[], closed = false, tension = 1): string {
  const count = points.length;
  if (count < 3) return polyPath(points, closed);
  const at = (index: number): Pt => closed ? points[(index + count) % count]! : points[clamp(index, 0, count - 1)]!;
  const k = tension / 6 * 100;
  const segments = closed ? count : count - 1;
  const path = new PathData();
  let previous = at(-1), point = at(0), next = at(1);
  let x = Math.round(point[0] * 100), y = Math.round(point[1] * 100);
  path.command("M");
  path.pair(x, y);
  path.command("c");
  path.pair(Math.round((next[0] - previous[0]) * k), Math.round((next[1] - previous[1]) * k));
  for (let index = 0; index < segments; index += 1) {
    previous = point;
    point = next;
    next = at(index + 2);
    const nx = Math.round(point[0] * 100), ny = Math.round(point[1] * 100);
    const tx = Math.round((next[0] - previous[0]) * k), ty = Math.round((next[1] - previous[1]) * k);
    if (index === 1) path.command("s");
    path.pair(nx - tx - x, ny - ty - y);
    path.pair(nx - x, ny - y);
    x = nx; y = ny;
  }
  return closed ? `${path.text}z` : path.text;
}
