import { describe, expect, it } from "vitest";
import { polyPath, type Pt, smoothPath } from "../src/geometry.js";
import { growGarden } from "../src/grow.js";
import { DEFAULT_INKS, withInks } from "../src/inks.js";
import { Sheet } from "../src/paint.js";
import { createRng } from "../src/random.js";
import { renderGarden } from "../src/render.js";

/** The points path data passes through, read back by SVG's number grammar, in hundredths of a centimetre. */
function passesThrough(d: string): [number, number][] {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/gu) ?? [];
  const points: [number, number][] = [];
  let command = "", x = 0, y = 0, start: [number, number] = [0, 0], index = 0;
  const next = (): number => Math.round(Number(tokens[index++]) * 100);
  while (index < tokens.length) {
    if (/[A-Za-z]/u.test(tokens[index]!)) command = tokens[index++]!;
    switch (command) {
      case "M": x = next(); y = next(); start = [x, y]; break;
      case "l": x += next(); y += next(); break;
      case "c": index += 4; x += next(); y += next(); break;
      case "s": index += 2; x += next(); y += next(); break;
      case "z": [x, y] = start; command = ""; continue;
      default: throw new Error(`unexpected ${command ? `command ${command}` : "numbers"} in ${d}`);
    }
    points.push([x, y]);
  }
  return points;
}

const garden = growGarden({ seed: 1793, form: "capitule", variant: {} });
const moment = { t: 0.7, fullness: 0.6 };

describe("rendering", () => {
  it("writes path data that passes through every point it is given, to the hundredth", () => {
    const rng = createRng(1793);
    const steps = [0, 0.001, 0.004, 0.006, 0.01, 0.05, 0.1, 0.5, 1, 3];
    let d = "";
    const expected: [number, number][] = [];
    for (let path = 0; path < 300; path += 1) {
      const points: Pt[] = [[rng.range(-3, 25), rng.range(-3, 25)]];
      const count = rng.int(1, 14);
      while (points.length < count) {
        const [x, y] = points.at(-1)!;
        points.push([x + rng.pick(steps) * (rng.chance(0.5) ? 1 : -1), y + rng.pick(steps) * (rng.chance(0.5) ? 1 : -1)]);
      }
      const closed = rng.chance(0.5), smooth = rng.chance(0.5);
      const hundredths = points.map(([x, y]): [number, number] => [Math.round(x * 100), Math.round(y * 100)]);
      d += smooth ? smoothPath(points, closed, rng.range(0.5, 1)) : polyPath(points, closed);
      // A smooth closed curve ends its last segment back at its first point.
      expected.push(...hundredths, ...(smooth && closed && count >= 3 ? [hundredths[0]!] : []));
    }
    expect(passesThrough(d)).toEqual(expected);
  });

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

  it("escapes guest URLs without allowing them to add SVG markup", () => {
    const visiting = growGarden({ seed: 1793, form: "capitule", guest: { kind: "visitor", aspect: 1, size: 1.4 } });
    const svg = renderGarden(visiting, moment, {
      manner: "taille-douce", id: "guest", scale: 10,
      guestFigure: `figures/guest.png?a=1&b="two"><text>three</text>'four'`,
    });
    expect(svg).toContain(`href="figures/guest.png?a=1&amp;b=&quot;two&quot;&gt;&lt;text&gt;three&lt;/text&gt;&apos;four&apos;"`);
    expect(svg).not.toContain("<text>");
  });

  it("keeps SVG ids and their references valid with punctuation in the prefix", () => {
    const svg = renderGarden(garden, moment, { manner: "lavis", id: `page "one" & <two> (#) Été K ſ`, scale: 10 });
    const ids = [...svg.matchAll(/\bid="([^"]*)"/gu)].map(match => match[1]!);
    const references = [...svg.matchAll(/(?:href="#|url\(#)([^")]+)/gu)].map(match => match[1]!);
    expect(ids.every(id => /^[A-Za-z0-9_-]+$/u.test(id))).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    expect(references.every(id => ids.includes(id))).toBe(true);
    const quoted = new Sheet(`page"one`).id(`shape"`);
    const literal = new Sheet("page_22_one").id(`shape"`);
    expect(quoted).toMatch(/^[a-z0-9_-]+$/iu);
    expect(quoted).not.toBe(literal);
  });
});
