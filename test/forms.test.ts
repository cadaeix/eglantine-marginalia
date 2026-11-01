import { describe, expect, it } from "vitest";
import type { Stage } from "../src/form.js";
import type { Pt } from "../src/geometry.js";
import { createRng } from "../src/random.js";
import { plantForm } from "../src/registry.js";
import type { Shape } from "../src/shapes.js";

const STAGES: Stage[] = ["bud", "bloom", "seed"];
const SEEDS = [1, 1793, 0xffffffff];
const outlinePoints = (shapes: Shape[]): Pt[] => shapes.flatMap(shape => shape.type === "body" || shape.type === "solid" ? shape.outline : []);
const span = (points: Pt[], axis: 0 | 1): number => Math.max(...points.map(p => p[axis])) - Math.min(...points.map(p => p[axis]));
const largestBodySpan = (shapes: Shape[], axis: 0 | 1): number => Math.max(...shapes.flatMap(shape => shape.type === "body" ? [span(shape.outline, axis)] : []));

describe("botanical form geometry", () => {
  it("gives permanent corymb buds a visible head above their stalk", () => {
    const form = plantForm("rosacee-coupe", { cluster: "corymb", seed: "haw" });
    const bud = form.motifs.find(motif => motif.name === "bud")!;
    const shapes = bud.draw(createRng(1793), 1, "bloom");
    const head = outlinePoints(shapes);
    const stalk = shapes.find(shape => shape.type === "line")!;
    const tip = stalk.points[stalk.points.length - 1]!;
    expect(span(head, 0)).toBeGreaterThan(0);
    expect(span(head, 1)).toBeGreaterThan(0);
    expect(Math.min(...head.map(p => p[1]))).toBeGreaterThanOrEqual(tip[1] - 1e-10);
    expect(Math.max(...head.map(p => p[1]))).toBeGreaterThan(tip[1]);
  });

  it("scales fig outlines with fruit size at every stage, including terminal pairs", () => {
    for (const seed of SEEDS) for (const stage of STAGES) {
      const forms = [0.4, 1, 1.5].map(size => plantForm("arbre-fruitier", { fruit: "fig", size }));
      const fruitShapes = forms.map(form => form.motifs.find(motif => motif.name === "fruit")!.draw(createRng(seed), 1, stage));
      for (const axis of [0, 1] as const) {
        const normal = span(outlinePoints(fruitShapes[1]!), axis);
        expect(normal).toBeGreaterThan(0);
        expect(span(outlinePoints(fruitShapes[0]!), axis)).toBeCloseTo(normal * 0.4, 10);
        expect(span(outlinePoints(fruitShapes[2]!), axis)).toBeCloseTo(normal * 1.5, 10);
      }
      const terminals = forms.map(form => form.terminal.draw(createRng(seed), 1, stage));
      for (const axis of [0, 1] as const) {
        const normal = largestBodySpan(terminals[1]!, axis);
        expect(normal).toBeGreaterThan(0);
        expect(largestBodySpan(terminals[0]!, axis)).toBeCloseTo(normal * 0.4, 10);
        expect(largestBodySpan(terminals[2]!, axis)).toBeCloseTo(normal * 1.5, 10);
      }
    }
  });

  it("fits bundle outlines and visible rootlets inside the standard column at accepted extremes", () => {
    for (const habit of ["study", "long"]) for (const girth of [0.06, 0.13, 0.3, 0.8]) {
      for (const length of [0.8, 3.6]) for (const count of [1, 8]) {
        const form = plantForm("racine-tubercule", { organ: "bundle", habit, girth, length, count, skin: "rough", section: true });
        for (const seed of SEEDS) for (const fullness of [0, 1]) {
          const shapes = form.foot!.draw(createRng(seed), { width: 6, height: 22 }, 1, fullness);
          for (const shape of shapes) {
            const points = shape.type === "body" ? [...shape.outline, ...shape.veins.flat()] : shape.type === "solid" ? shape.outline : shape.points;
            const radius = shape.type === "dots" ? shape.radius : shape.type === "line" ? shape.width / 2 : 0;
            expect(Math.min(...points.map(p => p[0])) - radius).toBeGreaterThanOrEqual(0);
            expect(Math.max(...points.map(p => p[0])) + radius).toBeLessThanOrEqual(6);
          }
        }
      }
    }
  });
});
