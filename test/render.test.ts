import { describe, expect, it } from "vitest";
import { growGarden } from "../src/grow.js";
import { DEFAULT_INKS, withInks } from "../src/inks.js";
import { renderGarden } from "../src/render.js";

const garden = growGarden({ seed: 1793, form: "capitule", variant: {} });
const moment = { t: 0.7, fullness: 0.6 };

describe("rendering", () => {
  it("lays decorations under the garden, among its layers inside the wash, and over it", () => {
    const svg = renderGarden(garden, moment, {
      manner: "lavis", id: "d", scale: 10,
      decorate: () => ({ under: "<g id=\"under\"/>", inlays: [{ layer: 2.5, svg: "<g id=\"among\"/>" }], over: "<g id=\"over\"/>" }),
    });
    const wash = svg.indexOf("<g filter=");
    const washEnd = svg.lastIndexOf("</g>", svg.indexOf("<g id=\"over\"/>"));
    expect(svg.indexOf("<g id=\"under\"/>")).toBeLessThan(wash);
    expect(svg.indexOf("<g id=\"among\"/>")).toBeGreaterThan(wash);
    expect(svg.indexOf("<g id=\"among\"/>")).toBeLessThan(washEnd);
    expect(svg.indexOf("<g id=\"over\"/>")).toBeGreaterThan(washEnd);
  });

  it("fixes the inks for a garden shown without a stylesheet, keeping the defaults for inks not given", () => {
    const svg = renderGarden(garden, moment, { manner: "taille-douce", id: "i", scale: 10 });
    expect(svg).toContain("var(--eglantine-ink, ");
    const fixed = withInks(svg, { ink: "#102030" });
    expect(fixed).not.toContain("var(");
    expect(fixed).toContain("#102030");
    expect(fixed).toContain(DEFAULT_INKS.paper);
    expect(fixed).not.toContain(DEFAULT_INKS.ink);
  });
});
