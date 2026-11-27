// A grid fixed to the page, and the edges of a form measured against it. The stipple and the screen manners each
// lay a form's marks cell by cell, taking every mark's values from its cell, so the same form is always marked alike.
import type { Pt } from "./geometry.js";
import type { Body } from "./shapes.js";

/** A stable 0..1 value from a form's first point, so each form is marked a little apart: a wash lighter or darker, a grid's marks salted. */
export function variance(body: Body): number {
  const [x = 0, y = 0] = body.outline[0] ?? [];
  const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return v - Math.floor(v);
}

/** A stable 0..1 value for a cell of a grid, one for each salt. */
export function cellValue(i: number, j: number, salt: number): number {
  let h = Math.imul(i, 0x27d4eb2d) ^ Math.imul(j, 0x165667b1) ^ Math.imul(salt, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** The height of the bands a form's edges are sorted into, in centimetres. */
const EDGE_BAND = 0.1;

interface Edge {
  ax: number;
  ay: number;
  by: number;
  dx: number;
  dy: number;
  lengthSquared: number;
  left: number;
  right: number;
}

/**
 * The edges of a form's rings sorted into bands across the page, so a point is measured against only the edges
 * near its height rather than every edge of the form: most cells of a grid lie far from any.
 */
export class Edges {
  /** Bands share their edges, including the measurements reused by every cell near them. */
  readonly #bands: Edge[][] = [];
  readonly #first: number;
  constructor(rings: readonly (readonly Pt[])[], reach: number) {
    let bottom = Infinity;
    for (const ring of rings) for (const point of ring) bottom = Math.min(bottom, point[1]);
    this.#first = Math.floor((bottom - reach) / EDGE_BAND);
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
        const [ax, ay] = ring[j]!, [bx, by] = ring[i]!;
        const dx = bx - ax, dy = by - ay;
        const edge: Edge = { ax, ay, by, dx, dy, lengthSquared: dx * dx + dy * dy, left: Math.min(ax, bx), right: Math.max(ax, bx) };
        // An edge goes into every band within `reach` of it, so a point finds every edge it is measured against.
        const from = Math.floor((Math.min(ay, by) - reach) / EDGE_BAND) - this.#first, to = Math.floor((Math.max(ay, by) + reach) / EDGE_BAND) - this.#first;
        for (let band = from; band <= to; band += 1) (this.#bands[band] ??= []).push(edge);
      }
    }
  }

  #near(y: number): readonly Edge[] | undefined {
    return this.#bands[Math.floor(y / EDGE_BAND) - this.#first];
  }

  /** Whether a point lies inside the rings, by the even-odd rule. */
  inside(x: number, y: number): boolean {
    const edges = this.#near(y);
    if (!edges) return false;
    let hit = false;
    for (const { ax, ay, by, dx, dy } of edges) {
      if ((ay > y) !== (by > y) && x < dx * (y - ay) / dy + ax) hit = !hit;
    }
    return hit;
  }

  /** How far a point lies from the nearest edge, up to the reach the edges were sorted for. */
  distance(x: number, y: number, reach: number): number {
    const edges = this.#near(y);
    if (!edges) return reach;
    let leastSquared = reach * reach;
    for (const { ax, ay, dx, dy, lengthSquared, left, right } of edges) {
      const gap = Math.max(left - x, x - right, 0);
      if (gap * gap > leastSquared) continue;
      const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / lengthSquared));
      const ex = x - ax - dx * t, ey = y - ay - dy * t;
      leastSquared = Math.min(leastSquared, ex * ex + ey * ey);
    }
    return Math.sqrt(leastSquared);
  }
}
