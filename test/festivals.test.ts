import { describe, expect, it } from "vitest";
import { calendarDay } from "../src/calendar/index.js";
import { FESTIVALS } from "../src/festival.js";
import type { Variant } from "../src/form.js";
import type { Pt } from "../src/geometry.js";
import { type Garden, growGarden, type MotifItem, type Page, stageAt, type StemItem, stemShown } from "../src/grow.js";
import { createRng } from "../src/random.js";
import type { Shape } from "../src/shapes.js";

interface Plant { name: string; form: string; variant: Variant }
/** The year's last plant, which the calendar's festivals take, and plants unlike it: a grain, a flower head, a climber, a root and a stump. */
const MARRON: Plant = calendarDay("2027-09-19").plant;
const PLANTS: Plant[] = [
  MARRON,
  { name: "blé", form: "epi-graminee", variant: { density: 1.3, nod: 0.15 } },
  { name: "tournesol", form: "capitule", variant: { rays: 24, rayLength: 0.4, disc: 0.3, leaf: "simple", basal: false, seed: "dry", size: 1.5 } },
  { name: "lierre", form: "grimpante", variant: { attach: "clinging", leaf: "ivy", lobes: 0.4, bloom: "umbel", woody: true } },
  { name: "carotte", form: "racine-tubercule", variant: { habit: "long", heart: true } },
  { name: "amadouvier", form: "cryptogame", variant: { mode: "bracket", cluster: 3, size: 1.2, habit: "ground" } },
];
const SEEDS = [1, 1793];
const TEXT = 10, BELOW = 8, GUTTER = 1;
const STAGES = ["bud", "bloom", "seed"] as const;
/** Opinion's marks lie over everything, at this layer and above, and they alone may write on the text. */
const OPINION_LAYER = 7;
const HEAVY = 120_000;

const layout = (garden: Garden): string => JSON.stringify(garden.items);
const shapePoints = (shape: Shape): Pt[] => shape.type === "body" ? [...shape.outline, ...shape.veins.flat()] : shape.type === "solid" ? shape.outline : shape.points;
/** The points an item draws at the end of a full day, in the garden's centimetres. */
function drawnPoints(garden: Garden, item: Garden["items"][number]): Pt[] {
  if (item.kind === "stem") return item.points;
  const stage = stageAt(item, 1, 1);
  if (stage === null) return [];
  const a = (item.angle - 90) * Math.PI / 180;
  return item.draw(createRng(item.seed), item.size, stage).flatMap(shapePoints).map(([lx, ly]): Pt => {
    const x = garden.mirrored ? -lx : lx;
    return [item.at[0] + x * Math.cos(a) - ly * Math.sin(a), item.at[1] + x * Math.sin(a) + ly * Math.cos(a)];
  });
}

describe("festivals", () => {
  for (const festival of FESTIVALS) {
    describe(festival, () => {
      it("grows the same garden from the same seed, with no guest though one is asked for", () => {
        for (const plant of PLANTS) for (const seed of SEEDS) {
          const spec = { seed, form: plant.form, variant: plant.variant, festival, guest: { kind: "visitor", aspect: 1.2, size: 1.4 } } as const;
          const garden = growGarden(spec);
          expect(layout(growGarden(spec)), `${plant.name}, seed ${seed}`).toBe(layout(garden));
          expect(garden.guest, plant.name).toBeNull();
        }
      }, HEAVY);

      it("never takes back what it has shown as the day goes on or fills", () => {
        const steps = Array.from({ length: 41 }, (_, index) => index / 40);
        const taken: string[] = [];
        for (const plant of PLANTS) for (const seed of SEEDS) {
          for (const item of growGarden({ seed, form: plant.form, variant: plant.variant, festival }).items) {
            const what = `${plant.name} ${seed} ${item.kind} ${item.order}`;
            if (item.kind === "stem") {
              let shown = 0;
              for (const t of steps) { const now = stemShown(item, t); if (now < shown) taken.push(`${what} shrinks at t ${t}`); shown = now; }
              if (shown !== 1) taken.push(`${what} never finishes growing`);
              continue;
            }
            const rank = (t: number, fullness: number): number => { const stage = stageAt(item, t, fullness); return stage === null ? -1 : STAGES.indexOf(stage); };
            for (const fixed of [0, 0.5, 1]) for (let k = 1; k < steps.length; k += 1) {
              if (rank(steps[k]!, fixed) < rank(steps[k - 1]!, fixed)) taken.push(`${what} goes back at t ${steps[k]} (fullness ${fixed})`);
              if (rank(fixed, steps[k]!) < rank(fixed, steps[k - 1]!)) taken.push(`${what} goes back at fullness ${steps[k]} (t ${fixed})`);
            }
            if (rank(1, 1) < 0) taken.push(`${what} is not shown at the end of a full day`);
          }
        }
        expect(taken).toEqual([]);
      }, HEAVY);

      it("keeps to its column, and on a page keeps its column and stays off the text but for Opinion's marks", () => {
        const strays: string[] = [];
        for (const plant of PLANTS) {
          const alone = growGarden({ seed: 1793, form: plant.form, variant: plant.variant, festival });
          expect([alone.width, alone.height, ...alone.column]).toEqual([6, 22, 0, 0, 6, 22]);
          for (const item of alone.items) for (const [x, y] of drawnPoints(alone, item)) {
            if (x < -0.6 || x > alone.width + 0.6 || y < 0 || y > alone.height) { strays.push(`${plant.name} ${item.kind} ${item.order} at ${x.toFixed(2)}, ${y.toFixed(2)}`); break; }
          }
          for (const side of ["left", "right"] as Page["side"][]) {
            const garden = growGarden({ seed: 1793, form: plant.form, variant: plant.variant, festival, page: { side, text: TEXT, below: BELOW } });
            expect(garden.width, `${plant.name} ${side}`).toBe(6 + TEXT);
            expect(garden.column[2] - garden.column[0]).toBe(6);
            const [x0, x1] = side === "left" ? [garden.column[2] + GUTTER, garden.width] : [0, garden.column[0] - GUTTER];
            for (const item of garden.items) {
              if (item.layer >= OPINION_LAYER) continue;
              const over = drawnPoints(garden, item).find(([x, y]) => x > x0 && x < x1 && y > BELOW);
              if (over) strays.push(`${plant.name} on a ${side} page: ${item.kind} ${item.order} over the text at ${over.map(v => v.toFixed(2)).join(", ")}`);
            }
          }
        }
        expect(strays).toEqual([]);
      }, HEAVY);
    });
  }

  it("Virtue keeps the stems and hangs the empty husk where each bloom was, with no leaf or bloom", () => {
    const marron = growGarden({ seed: 1793, form: MARRON.form, variant: MARRON.variant, festival: "vertu" });
    const motifs = marron.items.filter((item): item is MotifItem => item.kind === "motif");
    expect(motifs.length).toBeGreaterThan(0);
    expect(new Set(motifs.map(item => item.name))).toEqual(new Set(["husk"]));
    expect(marron.items.filter(item => item.kind === "stem" && item.main).length).toBeGreaterThan(0);
    // A grain's ear leaves no husk, so only its stems stand.
    const wheat = PLANTS[1]!;
    expect(growGarden({ seed: 1793, form: wheat.form, variant: wheat.variant, festival: "vertu" }).items.every(item => item.kind === "stem")).toBe(true);
  });

  it("the Revolution leaves one seed in the middle of the column, whose root comes out towards evening", () => {
    for (const seed of SEEDS) {
      const garden = growGarden({ seed, form: MARRON.form, variant: MARRON.variant, festival: "revolution" });
      const motifs = garden.items.filter((item): item is MotifItem => item.kind === "motif");
      expect(motifs.length).toBe(1);
      const [kernel] = motifs as [MotifItem];
      const a = kernel.angle * Math.PI / 180;
      const centre: Pt = [kernel.at[0] + Math.cos(a) * kernel.size / 2, kernel.at[1] + Math.sin(a) * kernel.size / 2];
      expect(Math.hypot(centre[0] - 3, centre[1] - 11)).toBeLessThan(0.05);
      const roots = garden.items.filter(item => item.kind === "stem");
      expect(roots.length).toBe(1);
      expect(roots.every(root => stemShown(root, 0.75) === 0 && stemShown(root, 1) === 1)).toBe(true);
    }
  });

  it("Genius plants a quill in le marron's empty burr, its stems passing behind the quill and, in stretches, in front of it", () => {
    const garden = growGarden({ seed: 1793, form: MARRON.form, variant: MARRON.variant, festival: "genie" });
    const motifs = garden.items.filter((item): item is MotifItem => item.kind === "motif");
    const quill = motifs.find(item => item.name === "quill")!;
    const husk = motifs.find(item => item.name === "husk")!;
    expect(quill.born).toBe(0);
    expect(Math.abs(husk.at[0] - quill.at[0])).toBeLessThan(0.3);
    const stems = garden.items.filter(item => item.kind === "stem");
    const mains = stems.filter(item => item.main);
    expect(mains.every(stem => stem.layer < quill.layer)).toBe(true);
    const fronts = stems.filter(stem => stem.layer > quill.layer);
    expect(fronts.length).toBeGreaterThan(0);
    // Each stretch drawn in front is a part of a main stem, so it grows with it.
    for (const front of fronts) expect(mains.some(main => main.points.some(([x, y]) => x === front.points[0]![0] && y === front.points[0]![1]))).toBe(true);
  });

  it("Rewards ties a crown of oak and the plant's leaves with a ribbon at dawn, and a quiet day still crowns the whole ring", () => {
    const garden = growGarden({ seed: 1793, form: MARRON.form, variant: MARRON.variant, festival: "recompenses" });
    const motifs = garden.items.filter((item): item is MotifItem => item.kind === "motif");
    expect(motifs.filter(item => item.name === "ribbon" && stageAt(item, 0, 0) !== null).length).toBe(1);
    const quiet = motifs.filter(item => (item.name === "oak" || item.name === "leaf") && stageAt(item, 1, 0) !== null);
    expect(new Set(quiet.map(item => item.name))).toEqual(new Set(["oak", "leaf"]));
    const ys = motifs.filter(item => item.name === "oak").map(item => item.at[1]);
    const middle = (Math.min(...ys) + Math.max(...ys)) / 2;
    const sides = [quiet.some(item => item.at[0] < 3), quiet.some(item => item.at[0] > 3), quiet.some(item => item.at[1] < middle), quiet.some(item => item.at[1] > middle)];
    expect(sides).toEqual([true, true, true, true]);
  });

  it("Labour binds the plant in a sheaf standing on its cut stalks, bare below its tie and leafing out above it", () => {
    for (const plant of [MARRON, PLANTS[1]!, PLANTS[4]!]) {
      const garden = growGarden({ seed: 1793, form: plant.form, variant: plant.variant, festival: "travail" });
      const motifs = garden.items.filter((item): item is MotifItem => item.kind === "motif");
      const tie = motifs.find(item => item.name === "tie")!;
      expect(tie.born, plant.name).toBeLessThanOrEqual(0.5);
      expect(garden.items.filter((item): item is StemItem => item.kind === "stem" && item.main).every(stem => stem.points[0]![1] < 1), plant.name).toBe(true);
      expect(motifs.filter(item => item.name !== "tie" && item.name !== "cut ends").every(item => item.at[1] > tie.at[1]), plant.name).toBe(true);
    }
  });

  it("Opinion's marks come in as the day fills, with a caricature on a bloom even on a quiet day, and on a full day write on a page's text", () => {
    const garden = growGarden({ seed: 1793, form: MARRON.form, variant: MARRON.variant, festival: "opinion" });
    const marks = (from: Garden, fullness: number): MotifItem[] => from.items.filter((item): item is MotifItem =>
      item.kind === "motif" && item.layer >= OPINION_LAYER && stageAt(item, 1, fullness) !== null);
    expect(marks(garden, 1).length).toBeGreaterThan(marks(garden, 0).length);
    const blooms = garden.items.filter((item): item is MotifItem => item.kind === "motif" && item.name === "terminal");
    expect(marks(garden, 0).some(mark => mark.name === "caricature" && blooms.some(bloom => Math.hypot(mark.at[0] - bloom.at[0], mark.at[1] - bloom.at[1]) < 1.5))).toBe(true);
    // A leaf struck through is there whenever its crossing-out is.
    const leaves = garden.items.filter((item): item is MotifItem => item.kind === "motif" && item.leafRank !== null && item.layer < OPINION_LAYER);
    for (const rature of marks(garden, 1).filter(mark => mark.name === "rature")) {
      const leaf = leaves.find(item => item.at[0] === rature.at[0] && item.at[1] === rature.at[1])!;
      for (const fullness of [0, 0.25, 0.5, 0.75, 1]) for (const t of [0.5, 1]) if (stageAt(rature, t, fullness) !== null) expect(stageAt(leaf, t, fullness)).not.toBeNull();
    }
    const page = growGarden({ seed: 1793, form: MARRON.form, variant: MARRON.variant, festival: "opinion", page: { side: "left", text: TEXT, below: BELOW } });
    const onText = (fullness: number): boolean => marks(page, fullness).some(mark => drawnPoints(page, mark).some(([x, y]) => x > page.column[2] + GUTTER && y > BELOW));
    expect([onText(0), onText(1)]).toEqual([false, true]);
  });
});
