import { describe, expect, it } from "vitest";
import { resolveVariant, type Variant } from "../src/form.js";
import { FORM_MODULES, plantForm } from "../src/registry.js";
import { type Garden, growGarden, type Ornament, stageAt, stemShown } from "../src/grow.js";
import { createRng, seedFromText } from "../src/random.js";
import type { Shape } from "../src/shapes.js";

interface Plant { name: string; form: string; variant: Variant }
/** Every example of every registered form: a new form is held to the same invariants as soon as it exists. */
const PLANTS: Plant[] = [...FORM_MODULES.values()].flatMap(module => module.examples.map(example => ({ name: example.name, form: module.id, variant: example.variant })));
/** The rooms a garden grows in: a margin's column, and the two printer's ornaments. */
const ROOMS = [null, "bandeau", "cul-de-lampe"] as const satisfies readonly (Ornament | null)[];
type Room = typeof ROOMS[number];
const fresh = (date: string, plant: Plant, room: Room): Garden =>
  growGarden({ seed: seedFromText(date), form: plant.form, variant: plant.variant, ...(room ? { ornament: room } : { width: 6, height: 22 }) });
/** Growth is pure, so each plant, room and day is grown once for every test that only reads the garden. */
const grown = new Map<string, Garden>();
const grow = (date: string, plant: Plant, room: Room): Garden => {
  const key = `${date}:${room}:${plant.form}:${plant.name}`;
  let garden = grown.get(key);
  if (!garden) { garden = fresh(date, plant, room); grown.set(key, garden); }
  return garden;
};
/** The layout without the drawing functions. */
const layout = (garden: Garden): string => JSON.stringify(garden.items);
const STAGES = ["bud", "bloom", "seed"] as const;
/** Every form's examples are grown several times over; the default per-test limit is too short for them. */
const HEAVY = 120_000;

type Box = [x0: number, y0: number, x1: number, y1: number];
/**
 * The box every stroke of a garden reaches at the end of a full day, in the garden's centimetres: its plant's, from
 * the drawings of its stems and motifs, and its foot's, as the renderer places the foot.
 */
function drawnBounds(garden: Garden): { plant: Box; foot: Box | null } {
  const plant: Box = [Infinity, Infinity, -Infinity, -Infinity];
  const reach = (box: Box, x: number, y: number, r: number): void => {
    box[0] = Math.min(box[0], x - r); box[1] = Math.min(box[1], y - r); box[2] = Math.max(box[2], x + r); box[3] = Math.max(box[3], y + r);
  };
  const strokes = (box: Box, shapes: Shape[], place: (x: number, y: number) => [number, number]): void => {
    for (const shape of shapes) {
      const r = shape.type === "line" ? shape.width / 2 : shape.type === "dots" ? shape.radius : 0;
      for (const [x, y] of shape.type === "line" || shape.type === "dots" ? shape.points : shape.outline) reach(box, ...place(x, y), r);
    }
  };
  for (const item of garden.items) {
    if (item.kind === "stem") { for (const [x, y] of item.points) reach(plant, x, y, item.w0 / 2); continue; }
    const stage = stageAt(item, 1, 1);
    if (!stage) continue;
    const a = (item.angle - 90) * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    strokes(plant, item.draw(createRng(item.seed), item.size, stage), (x, y) => [item.at[0] + x * c - y * s, item.at[1] + x * s + y * c]);
  }
  if (!garden.foot) return { plant, foot: null };
  const foot: Box = [Infinity, Infinity, -Infinity, -Infinity];
  const { x: left, width, drop, scale } = garden.foot;
  strokes(foot, garden.foot.draw(createRng(garden.foot.seed), { width, height: (garden.height + drop) / scale }, 1, 1), (x, y) => [left + x * scale, y * scale - drop]);
  return { plant, foot };
}

for (const room of ROOMS) {
  describe(room ?? "margin garden", () => {
    if (room === null) {
      it("knows its forms, and every example's variant is one its form accepts", () => {
        expect(PLANTS.length).toBeGreaterThanOrEqual(FORM_MODULES.size);
        for (const module of FORM_MODULES.values()) {
          expect(module.examples.length).toBeGreaterThan(0);
          for (const example of module.examples) expect(() => resolveVariant(module, example.variant)).not.toThrow();
        }
      });
    }

    it("grows the same garden from the same seed, and a different one from another day", () => {
      for (const plant of PLANTS) {
        expect(layout(fresh("2026-10-30", plant, room))).toBe(layout(grow("2026-10-30", plant, room)));
        expect(layout(grow("2026-10-30", plant, room))).not.toBe(layout(grow("2026-10-31", plant, room)));
      }
    }, HEAVY);

    it("never takes back what it has shown as the day goes on or fills", () => {
      const steps = Array.from({ length: 51 }, (_, index) => index / 50);
      const taken: string[] = [];
      for (const plant of PLANTS) {
        const garden = grow("2026-10-30", plant, room);
        for (const item of garden.items) {
          const what = `${plant.name} ${item.kind} ${item.order}`;
          if (item.kind === "stem") {
            let shown = 0;
            for (const t of steps) {
              const now = stemShown(item, t);
              if (now < shown) taken.push(`${what} shrinks at t ${t}`);
              shown = now;
            }
            if (shown !== 1) taken.push(`${what} never finishes growing`);
            continue;
          }
          const rank = (t: number, fullness: number): number => { const stage = stageAt(item, t, fullness); return stage === null ? -1 : STAGES.indexOf(stage); };
          for (const fixed of [0, 0.5, 1]) {
            for (let k = 1; k < steps.length; k += 1) {
              if (rank(steps[k]!, fixed) < rank(steps[k - 1]!, fixed)) taken.push(`${what} goes back at t ${steps[k]} (fullness ${fixed})`);
              if (rank(fixed, steps[k]!) < rank(fixed, steps[k - 1]!)) taken.push(`${what} goes back at fullness ${steps[k]} (t ${fixed})`);
            }
          }
          if (rank(1, 1) < 1) taken.push(`${what} is not shown at the end of a full day`);
        }
      }
      expect(taken).toEqual([]);
    }, HEAVY);

    it("gives a quiet day fewer leaves than a full one, and the same blooms", () => {
      for (const plant of PLANTS) {
        const garden = grow("2026-10-30", plant, room);
        const shown = (fullness: number, leaves: boolean): number => garden.items.filter(item =>
          item.kind === "motif" && (item.leafRank !== null) === leaves && stageAt(item, 1, fullness) !== null).length;
        expect(shown(0, true), plant.name).toBeGreaterThan(0);
        expect(shown(0, true), plant.name).toBeLessThan(shown(1, true) * 0.5);
        expect(shown(0, false), plant.name).toBe(shown(1, false));
      }
    }, HEAVY);

    it("grows a footed plant out of its foot's crown, keeping leaves and blooms out of the room the foot fills", () => {
      for (const plant of PLANTS) {
        const foot = plantForm(plant.form, plant.variant).foot;
        if (!foot) continue;
        const garden = grow("2026-10-31", plant, room);
        // Where the garden put the foot: in the column as it is, in a band perhaps shrunk, lowered or centred.
        const placed = garden.foot!;
        const at = (x: number, y: number): [number, number] => [placed.x + x * placed.width * placed.scale, y * placed.scale - placed.drop];
        const crown = at(...foot.crown);
        const starts = garden.mains.map(points => points[0]!);
        const onCrown = starts.filter(([x, y]) => Math.hypot(x - crown[0], y - crown[1]) < 0.45);
        if (room === "bandeau") {
          // A bed's plants stand in a row along the foot's ground, one of them on its crown.
          if (starts.length > 0) expect(onCrown.length, plant.name).toBeGreaterThan(0);
          for (const [, y] of starts) expect(y, plant.name).toBeCloseTo(crown[1], 6);
        } else {
          expect(onCrown, plant.name).toHaveLength(starts.length);
        }
        const inside = ([x, y]: readonly number[]): boolean => foot.room.some(([x0, y0, x1, y1]) => {
          const [left, bottom] = at(x0, y0), [right, top] = at(x1, y1);
          return x! > left + 0.1 && x! < right - 0.1 && y! > bottom + 0.1 && y! < top - 0.1;
        });
        const trespass = garden.items.filter(item => item.kind === "motif" && item.name !== "basal" && inside(item.at)).map(item => item.kind === "motif" ? item.name : "");
        expect({ plant: plant.name, trespass }).toEqual({ plant: plant.name, trespass: [] });
      }
    }, HEAVY);

    if (room === null) {
      it("keeps the plant inside its column and leaves the sky above it open", () => {
        for (const plant of PLANTS) {
          const garden = grow("2026-10-31", plant, room);
          for (const item of garden.items) {
            const points = item.kind === "stem" ? item.points : [item.at];
            for (const [x, y] of points) {
              expect(x).toBeGreaterThan(-0.6);
              expect(x).toBeLessThan(garden.width + 0.6);
              expect(y).toBeGreaterThan(0);
              expect(y).toBeLessThan(garden.height * 0.8 + 0.5);
            }
          }
          expect(garden.crown[1]).toBeLessThan(garden.height * 0.9);
        }
      }, HEAVY);
    } else {
      it("keeps every stroke inside the band, but for a little past its ends", () => {
        // Leaves at a band's ends may reach a few millimetres past them, as they overhang a column's edge.
        const OVERHANG = 0.35;
        const outside: string[] = [];
        for (const plant of PLANTS) {
          for (const date of ["2026-10-30", "2026-10-31"]) {
            const garden = grow(date, plant, room);
            const { plant: drawn, foot } = drawnBounds(garden);
            const what = `${plant.form} ${plant.name} ${date}`;
            if (drawn[1] < -0.02 || drawn[3] > garden.height + 0.02) outside.push(`${what} runs past the band's foot or top`);
            if (drawn[0] < -OVERHANG || drawn[2] > garden.width + OVERHANG) outside.push(`${what} runs far past the band's ends`);
            // A foot that runs the band's width is cut by its ends, as a deep one is by its lower edge; only its top must keep inside.
            if (foot && foot[3] > garden.height) outside.push(`${what} has a foot that runs past the band's top`);
          }
        }
        expect(outside).toEqual([]);
      }, HEAVY);
    }

    if (room === "bandeau") {
      it("stands its plants side by side along the band's foot, across most of its width", () => {
        for (const plant of PLANTS) {
          const garden = grow("2026-10-30", plant, room);
          const roots = garden.mains.map(points => points[0]!);
          if (roots.length === 0) continue;
          const xs = roots.map(([x]) => x);
          expect(Math.max(...xs) - Math.min(...xs), plant.name).toBeGreaterThan(garden.width / 2);
          for (const [, y] of roots) expect(y, plant.name).toBe(roots[0]![1]);
        }
      }, HEAVY);
    }

    if (room === "cul-de-lampe") {
      it("sprays from one root in the middle of the band's foot, and keeps its lower corners clear", () => {
        for (const plant of PLANTS) {
          const garden = grow("2026-10-30", plant, room);
          const roots = garden.mains.map(points => points[0]!);
          for (const root of roots) expect(root, plant.name).toEqual(roots[0]);
          if (roots.length > 0) expect(Math.abs(roots[0]![0] - garden.width / 2), plant.name).toBeLessThan(0.5);
          const cornered = garden.items.filter(item => item.kind === "motif"
            && item.at[1] < garden.height * 0.2 && Math.abs(item.at[0] - garden.width / 2) > garden.width * 0.3);
          expect({ plant: plant.name, cornered: cornered.length }).toEqual({ plant: plant.name, cornered: 0 });
        }
      }, HEAVY);
    }
  });
}

describe("printer's ornaments", () => {
  it("refuses to grow a band round a page, or as an ornament it does not know", () => {
    expect(() => growGarden({ seed: 1793, form: "capitule", ornament: "bandeau", page: { side: "left", text: 14, below: 9 } })).toThrow(RangeError);
    expect(() => growGarden({ seed: 1793, form: "capitule", ornament: "frontispice" as Ornament })).toThrow(RangeError);
  });
});
