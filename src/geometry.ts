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
/** A coordinate in SVG path data: a hundredth of a centimetre is finer than a pixel at screen sizes. */
export const num = (value: number): string => trim(value.toFixed(2));
/** A stroke width or radius, which can be finer than any coordinate. */
export const fine = (value: number): string => trim(value.toFixed(4));

/** A straight polyline or polygon as SVG path data. */
export function polyPath(points: readonly Pt[], closed = false): string {
  if (points.length === 0) return "";
  const body = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${num(x)} ${num(y)}`).join("");
  return closed ? `${body}Z` : body;
}

/** A smooth curve through the points (Catmull-Rom as cubic Béziers) as SVG path data. */
export function smoothPath(points: readonly Pt[], closed = false, tension = 1): string {
  const count = points.length;
  if (count < 3) return polyPath(points, closed);
  const at = (index: number): Pt => closed ? points[(index + count) % count]! : points[clamp(index, 0, count - 1)]!;
  let d = `M${num(points[0]![0])} ${num(points[0]![1])}`;
  const segments = closed ? count : count - 1;
  for (let index = 0; index < segments; index += 1) {
    const p0 = at(index - 1), p1 = at(index), p2 = at(index + 1), p3 = at(index + 2);
    const k = tension / 6;
    d += `C${num(p1[0] + (p2[0] - p0[0]) * k)} ${num(p1[1] + (p2[1] - p0[1]) * k)} ${num(p2[0] - (p3[0] - p1[0]) * k)} ${num(p2[1] - (p3[1] - p1[1]) * k)} ${num(p2[0])} ${num(p2[1])}`;
  }
  return closed ? `${d}Z` : d;
}
