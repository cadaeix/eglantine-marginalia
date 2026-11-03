import { describe, expect, it } from "vitest";
import type { Variant } from "../src/form.js";
import type { Pt } from "../src/geometry.js";
import { type Garden, growGarden, type Page } from "../src/grow.js";
import { createRng } from "../src/random.js";
import { FORM_MODULES, plantForm } from "../src/registry.js";
import type { Shape } from "../src/shapes.js";

interface Plant { name: string; form: string; variant: Variant }
const PLANTS: Plant[] = [...FORM_MODULES.values()].flatMap(module => module.examples.map(example => ({ name: example.name, form: module.id, variant: example.variant })));
const footOf = (plant: Plant) => plantForm(plant.form, plant.variant).foot ?? null;
const TEXT = 10, BELOW = 8;
/** Leaves on the column's edge overhang it by up to a centimetre, so a page leaves this gutter beside its text. */
const GUTTER = 1;
const HEAVY = 120_000;
const SIDES = ["left", "right"] as const;

/** Growth is pure, so each plant and page is grown once for every test that only reads the garden. */
const grown = new Map<string, Garden>();
const onPage = (plant: Plant, side: Page["side"], below = BELOW): Garden => {
  const key = `${plant.form}:${plant.name}:${side}:${below}`;
  let garden = grown.get(key);
  if (!garden) { garden = growGarden({ seed: 1793, form: plant.form, variant: plant.variant, page: { side, text: TEXT, below } }); grown.set(key, garden); }
  return garden;
};
/** Motifs placed under the text, a centimetre or more clear of the column. */
const beyondColumn = (garden: Garden, side: Page["side"]) => garden.items.filter(item => item.kind === "motif"
  && (side === "left" ? item.at[0] > garden.column[2] + 1 : item.at[0] < garden.column[0] - 1));

const shapePoints = (shape: Shape): Pt[] => shape.type === "body" ? [...shape.outline, ...shape.veins.flat()] : shape.type === "solid" ? shape.outline : shape.points;

/** Every point the garden draws at the end of a full day, on the page. */
function drawnPoints(garden: Garden): Pt[] {
  return garden.items.flatMap(item => {
    if (item.kind === "stem") return item.points;
    const a = (item.angle - 90) * Math.PI / 180;
    return item.draw(createRng(item.seed), item.size, "bloom").flatMap(shapePoints).map(([lx, ly]): Pt => {
      const x = garden.mirrored ? -lx : lx;
      return [item.at[0] + x * Math.cos(a) - ly * Math.sin(a), item.at[1] + x * Math.sin(a) + ly * Math.cos(a)];
    });
  });
}

describe("a garden on a page", () => {
  for (const side of SIDES) {
    it(`never draws over the text, with the column on the ${side}`, () => {
      const over: string[] = [];
      for (const plant of PLANTS) {
        const garden = onPage(plant, side);
        // The text block beyond the gutter beside the column, from the bottom of its last line up.
        const [x0, x1] = side === "left" ? [garden.column[2] + GUTTER, garden.width] : [0, garden.column[0] - GUTTER];
        const inside = drawnPoints(garden).filter(([x, y]) => x > x0 && x < x1 && y > BELOW);
        if (inside.length > 0) over.push(`${plant.name} at ${inside[0]!.map(v => v.toFixed(2)).join(", ")}`);
      }
      expect(over).toEqual([]);
    }, HEAVY);
  }

  it("sends a runner from bare ground along the page's foot, under the text", () => {
    const bare = PLANTS.filter(plant => !footOf(plant));
    const stayed = bare.flatMap((plant, index) => {
      const side = SIDES[index % 2]!;
      return beyondColumn(onPage(plant, side, 2), side).length > 0 ? [] : [`${plant.name} (${side})`];
    });
    expect(stayed).toEqual([]);
  }, HEAVY);

  it("arcs into the room left by text that ends early, above any foot, each arc ending in a bloom", () => {
    const stayed: string[] = [];
    PLANTS.forEach((plant, index) => {
      if (plantForm(plant.form, plant.variant).stems.count === 0) return;
      // A tall foot needs the text to end high enough to leave room above it.
      const side = SIDES[index % 2]!, below = footOf(plant) ? 18 : BELOW;
      const garden = onPage(plant, side, below);
      // The main stems' blooms stay in the column, so a bloom under the text ends an arc.
      if (!beyondColumn(garden, side).some(item => item.kind === "motif" && item.name === "terminal")) stayed.push(`${plant.name} (${side}, ${below} cm below the text)`);
    });
    expect(stayed).toEqual([]);
  }, HEAVY);

  it("lays out a right-hand page as the mirror image of a left-hand one", () => {
    for (const plant of PLANTS.filter(plant => !footOf(plant))) {
      const left = onPage(plant, "left"), right = onPage(plant, "right");
      expect(right.items.length).toBe(left.items.length);
      expect(right.column).toEqual([TEXT, 0, left.column[2] + TEXT, left.height]);
      left.items.forEach((item, index) => {
        const twin = right.items[index]!;
        if (item.kind === "stem" && twin.kind === "stem") {
          item.points.forEach((p, k) => { expect(twin.points[k]![0]).toBeCloseTo(left.width - p[0], 10); expect(twin.points[k]![1]).toBe(p[1]); });
        } else if (item.kind === "motif" && twin.kind === "motif") {
          expect(twin.at[0]).toBeCloseTo(left.width - item.at[0], 10);
          expect(twin.at[1]).toBe(item.at[1]);
          expect(twin.angle).toBeCloseTo(180 - item.angle, 10);
          expect(twin.size).toBe(item.size);
        } else expect.fail(`${plant.name}: item ${index} is a ${item.kind} on the left and a ${twin.kind} on the right`);
      });
    }
  }, HEAVY);

  it("grows a footed plant on a right-hand page out of its foot's crown, keeping out of the room the foot fills", () => {
    for (const plant of PLANTS) {
      const foot = footOf(plant);
      if (!foot) continue;
      const garden = onPage(plant, "right");
      // The foot is drawn as it is, not mirrored, wherever the column stands.
      const [cx0, , cx1] = garden.column, width = cx1 - cx0;
      const crown = [cx0 + foot.crown[0] * width, foot.crown[1]];
      for (const points of garden.mains) expect(Math.hypot(points[0]![0] - crown[0]!, points[0]![1] - crown[1]!)).toBeLessThan(0.45);
      const inside = ([x, y]: Pt): boolean => foot.room.some(([x0, y0, x1, y1]) =>
        x > cx0 + x0 * width + 0.1 && x < cx0 + x1 * width - 0.1 && y > y0 + 0.1 && y < y1 - 0.1);
      const trespass = garden.items.flatMap(item => item.kind === "motif" && item.name !== "basal" && inside(item.at) ? [item.name] : []);
      expect({ plant: plant.name, trespass }).toEqual({ plant: plant.name, trespass: [] });
    }
  }, HEAVY);

  it("refuses a page it cannot lay out", () => {
    const grow = (page: Page) => () => growGarden({ seed: 1, form: "capitule", page });
    expect(grow({ side: "top" as Page["side"], text: 10, below: 5 })).toThrow(RangeError);
    expect(grow({ side: "left", text: 0, below: 5 })).toThrow(RangeError);
    expect(grow({ side: "left", text: Infinity, below: 5 })).toThrow(RangeError);
    expect(grow({ side: "right", text: 10, below: -1 })).toThrow(RangeError);
    expect(grow({ side: "right", text: 10, below: 23 })).toThrow(RangeError);
    expect(grow({ side: "right", text: 10, below: Number.NaN })).toThrow(RangeError);
  });
});
