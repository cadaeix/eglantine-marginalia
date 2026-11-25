import { describe, expect, it } from "vitest";
import { growGarden, renderGarden, type StemItem } from "../src/index.js";
import { calendarDay } from "../src/calendar/index.js";

/** Evaluate a stem polyline's x at a given y by linear interpolation. */
function stemXAt(points: readonly (readonly [number, number])[], y: number): number {
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    if ((y0 <= y && y <= y1) || (y1 <= y && y <= y0)) {
      const t = y1 === y0 ? 0 : (y - y0) / (y1 - y0);
      return x0 + (x1 - x0) * t;
    }
  }
  throw new Error(`y=${y} outside stem range [${points[0]?.[1]}, ${points.at(-1)?.[1]}]`);
}

describe("continuous segmented columns", () => {
  it("matches unsegmented output byte-for-byte when segment count is 1", () => {
    const plain = growGarden({ seed: 42, form: "capitule" });
    const single = growGarden({ seed: 42, form: "capitule", segment: { index: 0, count: 1 } });
    expect(renderGarden(single, { t: 0.7, fullness: 0.6 }, { manner: "bois", id: "s", scale: 36 }))
      .toBe(renderGarden(plain, { t: 0.7, fullness: 0.6 }, { manner: "bois", id: "s", scale: 36 }));
  });

  it("matches main-stem x coordinates and widths across band seams", () => {
    const H = 22;
    const bands = [0, 1, 2].map(index => growGarden({ seed: 1793, form: "grimpante", height: H, segment: { index, count: 3 } }));
    for (let i = 0; i < bands.length - 1; i += 1) {
      const lower = bands[i]!;
      const upper = bands[i + 1]!;
      expect(lower.mains.length).toBeGreaterThan(0);
      expect(upper.mains.length).toBeGreaterThan(0);
      // Leading stem runs across every seam.
      const exitX = stemXAt(lower.mains[0]!, H);
      const enterX = stemXAt(upper.mains[0]!, 0);
      expect(Math.abs(exitX - enterX)).toBeLessThan(1e-4);

      const lowerStem = lower.items.find((item): item is StemItem => item.kind === "stem" && item.main)!;
      const upperStem = upper.items.find((item): item is StemItem => item.kind === "stem" && item.main)!;
      // Width tapers smoothly across the seam (within bleed tolerance).
      expect(Math.abs(lowerStem.w1 - upperStem.w0)).toBeLessThan(0.01);
    }
    // Foot/basal rosette only on band 0; terminal crown on band 2.
    expect(bands[0]!.items.some(item => item.kind === "motif" && item.name === "terminal")).toBe(false);
    expect(bands[2]!.items.some(item => item.kind === "motif" && item.name === "terminal")).toBe(true);
  });

  it("renders foot only on band 0 and survives stemless forms across upper bands", () => {
    // 28 brumaire = truffe (cryptogame, stemless underground fungus)
    const truffle = calendarDay("2026-11-18");
    const b0 = growGarden({ seed: 99, form: truffle.plant.form, variant: truffle.plant.variant, segment: { index: 0, count: 3 } });
    const b1 = growGarden({ seed: 99, form: truffle.plant.form, variant: truffle.plant.variant, segment: { index: 1, count: 3 } });
    const b2 = growGarden({ seed: 99, form: truffle.plant.form, variant: truffle.plant.variant, segment: { index: 2, count: 3 } });
    expect(b0.foot).not.toBeNull();
    expect(b1.foot).toBeNull();
    expect(b2.foot).toBeNull();
    for (const band of [b0, b1, b2]) {
      const svg = renderGarden(band, { t: 0.9, fullness: 0.8 }, { manner: "lavis", id: "t", scale: 36 });
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
    }
  });

  it("crops only band 0 in hanging mode so lower bands join without gaps", () => {
    const b0 = growGarden({ seed: 55, form: "rosacee-coupe", segment: { index: 0, count: 2 } });
    const b1 = growGarden({ seed: 55, form: "rosacee-coupe", segment: { index: 1, count: 2 } });
    const svg0 = renderGarden(b0, { t: 0.8, fullness: 0.7 }, { manner: "bois", id: "h0", scale: 36, hanging: true });
    const svg1 = renderGarden(b1, { t: 0.8, fullness: 0.7 }, { manner: "bois", id: "h1", scale: 36, hanging: true });
    expect(svg0).not.toContain('viewBox="0 0 6 22"');
    expect(svg1).toContain('viewBox="0 0 6 22"');

    const bled = renderGarden(b1, { t: 0.8, fullness: 0.7 }, { manner: "bois", id: "hb", scale: 36, bleed: 0.9 });
    expect(bled).toContain('viewBox="-0.9 0 7.8 22"');
  });

  it("refuses invalid segments or incompatible layouts", () => {
    expect(() => growGarden({ seed: 1, form: "capitule", segment: { index: 2, count: 2 } })).toThrow(RangeError);
    expect(() => growGarden({ seed: 1, form: "capitule", segment: { index: -1, count: 2 } })).toThrow(RangeError);
    expect(() => growGarden({ seed: 1, form: "capitule", ornament: "bandeau", segment: { index: 0, count: 2 } })).toThrow(RangeError);
    expect(() => growGarden({ seed: 1, form: "capitule", page: { side: "left", text: 10, below: 4 }, segment: { index: 0, count: 2 } })).toThrow(RangeError);
  });
});

describe("event anchors", () => {
  it("leaves gardens identical when anchors are empty", () => {
    const plain = growGarden({ seed: 77, form: "rosacee-coupe" });
    const empty = growGarden({ seed: 77, form: "rosacee-coupe", anchors: [] });
    expect(renderGarden(empty, { t: 0.8, fullness: 0.8 }, { manner: "bois", id: "a", scale: 36 }))
      .toBe(renderGarden(plain, { t: 0.8, fullness: 0.8 }, { manner: "bois", id: "a", scale: 36 }));
  });

  it("attracts blooms toward anchored heights deterministically", () => {
    const targetY = 0.25;
    const anchoredA = growGarden({ seed: 123, form: "rosacee-coupe", anchors: [{ y: targetY, kind: "bloom", weight: 2 }] });
    const anchoredB = growGarden({ seed: 123, form: "rosacee-coupe", anchors: [{ y: targetY, kind: "bloom", weight: 2 }] });
    expect(renderGarden(anchoredA, { t: 0.8, fullness: 0.8 }, { manner: "bois", id: "b", scale: 36 }))
      .toBe(renderGarden(anchoredB, { t: 0.8, fullness: 0.8 }, { manner: "bois", id: "b", scale: 36 }));
    const nearBloom = anchoredA.items.some(item => item.kind === "motif" && item.staged && Math.abs(item.at[1] / anchoredA.height - targetY) < 0.14);
    expect(nearBloom).toBe(true);
  });
});
