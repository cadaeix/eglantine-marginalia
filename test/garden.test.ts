import { describe, expect, it } from "vitest";
import { resolveVariant, type Variant } from "../src/form.js";
import { FORM_MODULES, plantForm } from "../src/registry.js";
import { type Garden, growGarden, stageAt, stemShown } from "../src/grow.js";
import { seedFromText } from "../src/random.js";

interface Plant { name: string; form: string; variant: Variant }
/** Every example of every registered form: a new form is held to the same invariants as soon as it exists. */
const PLANTS: Plant[] = [...FORM_MODULES.values()].flatMap(module => module.examples.map(example => ({ name: example.name, form: module.id, variant: example.variant })));
const fresh = (date: string, plant: Plant): Garden => growGarden({ seed: seedFromText(date), form: plant.form, variant: plant.variant, width: 6, height: 22 });
/** Growth is pure, so each plant and day is grown once for every test that only reads the garden. */
const grown = new Map<string, Garden>();
const grow = (date: string, plant: Plant): Garden => {
  const key = `${date}:${plant.form}:${plant.name}`;
  let garden = grown.get(key);
  if (!garden) { garden = fresh(date, plant); grown.set(key, garden); }
  return garden;
};
/** The layout without the drawing functions. */
const layout = (garden: Garden): string => JSON.stringify(garden.items);
const STAGES = ["bud", "bloom", "seed"] as const;
/** Every form's examples are grown several times over; the default per-test limit is too short for them. */
const HEAVY = 120_000;

describe("margin garden", () => {
  it("knows its forms, and every example's variant is one its form accepts", () => {
    expect(PLANTS.length).toBeGreaterThanOrEqual(FORM_MODULES.size);
    for (const module of FORM_MODULES.values()) {
      expect(module.examples.length).toBeGreaterThan(0);
      for (const example of module.examples) expect(() => resolveVariant(module, example.variant)).not.toThrow();
    }
  });

  it("grows the same garden from the same seed, and a different one from another day", () => {
    for (const plant of PLANTS) {
      expect(layout(fresh("2026-10-30", plant))).toBe(layout(grow("2026-10-30", plant)));
      expect(layout(grow("2026-10-30", plant))).not.toBe(layout(grow("2026-10-31", plant)));
    }
  }, HEAVY);

  it("never takes back what it has shown as the day goes on or fills", () => {
    const steps = Array.from({ length: 51 }, (_, index) => index / 50);
    const taken: string[] = [];
    for (const plant of PLANTS) {
      const garden = grow("2026-10-30", plant);
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
      const garden = grow("2026-10-30", plant);
      const shown = (fullness: number, leaves: boolean): number => garden.items.filter(item =>
        item.kind === "motif" && (item.leafRank !== null) === leaves && stageAt(item, 1, fullness) !== null).length;
      expect(shown(0, true)).toBeGreaterThan(0);
      expect(shown(0, true)).toBeLessThan(shown(1, true) * 0.5);
      expect(shown(0, false)).toBe(shown(1, false));
    }
  }, HEAVY);

  it("keeps the plant inside its column and leaves the sky above it open", () => {
    for (const plant of PLANTS) {
      const garden = grow("2026-10-31", plant);
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

  it("grows a footed plant out of its foot's crown, keeping leaves and blooms out of the room the foot fills", () => {
    for (const plant of PLANTS) {
      const foot = plantForm(plant.form, plant.variant).foot;
      if (!foot) continue;
      const garden = grow("2026-10-31", plant);
      const crown = [foot.crown[0] * garden.width, foot.crown[1]];
      for (const points of garden.mains) expect(Math.hypot(points[0]![0] - crown[0]!, points[0]![1] - crown[1]!)).toBeLessThan(0.45);
      const inside = ([x, y]: readonly number[]): boolean => foot.room.some(([x0, y0, x1, y1]) =>
        x! > x0 * garden.width + 0.1 && x! < x1 * garden.width - 0.1 && y! > y0 + 0.1 && y! < y1 - 0.1);
      const trespass = garden.items.filter(item => item.kind === "motif" && item.name !== "basal" && inside(item.at)).map(item => item.kind === "motif" ? item.name : "");
      expect({ plant: plant.name, trespass }).toEqual({ plant: plant.name, trespass: [] });
    }
  }, HEAVY);
});
