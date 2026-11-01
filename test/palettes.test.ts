import { describe, expect, it } from "vitest";
import { PALETTES, paletteInks, palettesCss } from "../src/palettes.js";

/** WCAG 2 contrast ratio between two hex colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string): number => {
    const [r, g, bl] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
}

describe("palettes", () => {
  it("lay every wash 6:1 to 10:1 from its paper and every line at least 7:1, in both readings", () => {
    const out: string[] = [];
    for (const palette of PALETTES) for (const reading of ["light", "dark"] as const) {
      const { ink, paper, wash } = palette[reading];
      const w = contrast(wash, paper), i = contrast(ink, paper);
      if (w < 6 || w > 10 || i < 7) out.push(`${palette.id}-${reading}: wash ${w.toFixed(2)}, ink ${i.toFixed(2)}`);
    }
    expect(out).toEqual([]);
  });

  it("have distinct ids, and a stylesheet that sets all four inks for each id and reading", () => {
    expect(new Set(PALETTES.map(palette => palette.id)).size).toBe(PALETTES.length);
    const css = palettesCss();
    for (const { id, light, dark } of PALETTES) {
      expect(css).toContain(`[data-eglantine-palette="${id}-light"] { --eglantine-ink: ${light.ink}; --eglantine-paper: ${light.paper}; --eglantine-accent: ${light.accent}; --eglantine-wash: ${light.wash}; }`);
      expect(css).toContain(`[data-eglantine-palette="${id}-dark"] { --eglantine-ink: ${dark.ink};`);
    }
    expect(() => paletteInks("jouy", "light"), "palettes go by their English ids").toThrow();
  });
});
