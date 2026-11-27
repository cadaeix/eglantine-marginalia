// The screen manners, mosaïque, carreaux and nékyia: the plant raised as light on a dark screen. They are not of any
// period, and are loaded on their own (see load-manner.ts), so a page that draws in a period manner never fetches them.
import { clamp, fine, lerp, num, type Pt, smoothstep } from "./geometry.js";
import { cellValue, Edges, variance } from "./grid.js";
import { inkRef } from "./inks.js";
import type { MannerModule, MannerStyle, Part, ScreenManner, Sheet } from "./paint.js";
import type { Body, Shape } from "./shapes.js";

const INK = inkRef("ink"), PAPER = inkRef("paper"), ACCENT = inkRef("accent"), WASH = inkRef("wash");

// Mosaïque sets every form in upright squares on a grid fixed to the page: wide translucent blocks deep inside it,
// finer tesserae thickening into a lit rim, loose ones drifting sideways off its edge with the odd streak of a
// broken signal, veins cut through as dark leading, and stems and lines stepped in pixels. These are painted in the
// page's frame, so a leaf lying aslant is still set square. Carreaux abstracts further: each form is a few large
// panes of light chained along its length, turned any way and see-through where they overlap, some dripping light
// below them, with chips of colour and lit windows scattered among them, and its stems broken into loose squares.
// Nékyia raises the plant as a digital necromancer would, in both at once: its leaves and the foot it stands on in
// fine tesserae of a neon of their own, its blooms and stems in panes. Each is a row naming a glazing for each part.

/** The mosaic's tessera, and the finer pixel its stems, lines and veins are stepped in, in centimetres. */
const TESSERA = 0.08, PIXEL = 0.04;
/** How far in from a form's edge its tesserae thicken into a lit rim, and how far either side of its shadow's edge the shade grades in. */
const MOSAIC_RIM = 0.12, MOSAIC_SOFT = 0.1;
/** How far beyond a form its tesserae come loose, in centimetres, and the chance one does at its very edge. */
const LOOSE_REACH = 0.32, LOOSE = 0.22;
/** The chance a block of four tesserae well inside a form is set as one wide one, and how far inside it must lie. */
const BLOCK = 0.35, BLOCK_DEPTH = 0.1;
/** The chance a loose tessera trails a streak, and the streak's longest reach, in tesserae. */
const STREAK = 0.08, STREAK_REACH = 9;
/** How the light's colour sweeps over the page: cycles a centimetre up it, and how far it sways across it. */
const SWEEP = 0.07, SWAY = 0.25;

/** The colours a mosaic's light runs through, in order, as it sweeps over the page. */
interface MosaicColours { readonly ramp: readonly string[] }

/** Mosaïque's light, from the wash round to the accent by the shorter way round the hue circle. */
const FOUR_INKS: MosaicColours = {
  ramp: [0, 25, 50, 75, 100].map(share => share === 0 ? WASH : share === 100 ? ACCENT : `color-mix(in oklch, ${WASH}, ${ACCENT} ${share}%)`),
};
/** Nékyia's tesserae take a light of their own, not the palette's: a city's neon seen through a broken screen. */
const NEON: MosaicColours = { ramp: ["#ff2f6d", "#ff3fd0", "#9d5cff", "#3f7bff", "#2fe0ff", "#46ffa8"] };
/**
 * Carreaux's light, after a neon city seen through a window, on the four inks alone: from the wash to the accent
 * the shorter way round the hue circle, and back the longer way only through its greens and its reds, leaving out
 * the yellows and oranges between.
 */
const WINDOWSILL: MosaicColours = {
  ramp: [
    WASH, ...[25, 50, 75].map(share => `color-mix(in oklch, ${WASH}, ${ACCENT} ${share}%)`), ACCENT,
    ...[20, 32, 88].map(share => `color-mix(in oklch longer hue, ${ACCENT}, ${WASH} ${share}%)`),
  ],
};
/** The share of a stem's or a line's pixels that spark in the ink, the brightest light there is. */
const SPARK = 0.15;

/** The colour of the light at a point, as it sweeps up the page and sways across it; `jitter` loosens it a little. */
function lightAt(colours: MosaicColours, x: number, y: number, jitter: number): string {
  const sweep = y * SWEEP + SWAY * Math.sin(x * 1.1 + y * 0.31) + 0.2 * jitter;
  return colours.ramp[Math.floor((sweep - Math.floor(sweep)) * colours.ramp.length)]!;
}

/** How a mosaic's marks are stacked: wide blocks, then tesserae and pixels, then the leading cut through them, then the lit rim. */
const enum Course { Block, Tessera, Leading, Lit }

/**
 * Squares, streaks and panes gathered by course and colour, so each colour of a course is one path. A grid's
 * squares are given in units of its cell, which keeps the path data short; panes, which lie askew, in centimetres.
 */
class Tiles {
  readonly #runs = new Map<string, { course: Course; colour: string; opacity: number; unit: number; d: string[] }>();
  #run(course: Course, colour: string, opacity: number, unit: number): string[] {
    const key = `${course}|${unit}|${opacity}|${colour}`;
    let run = this.#runs.get(key);
    if (!run) this.#runs.set(key, run = { course, colour, opacity, unit, d: [] });
    return run.d;
  }
  add(course: Course, colour: string, opacity: number, unit: number, x: number, y: number, width: number, height: number): void {
    this.#run(course, colour, opacity, unit).push(`M${num(x)} ${num(y)}h${num(width)}v${num(height)}h${num(-width)}z`);
  }
  polygon(course: Course, colour: string, opacity: number, corners: readonly Pt[]): void {
    this.#run(course, colour, opacity, 1).push(`M${corners.map(([x, y]) => `${num(x)} ${num(y)}`).join("L")}z`);
  }
  svg(): string {
    return [...this.#runs.values()].sort((a, b) => a.course - b.course)
      .map(({ colour, opacity, unit, d }) => `<path${unit === 1 ? "" : ` transform="scale(${fine(unit)})"`} d="${d.join("")}" fill="${colour}"${opacity === 1 ? "" : ` fill-opacity="${num(opacity)}"`}/>`)
      .join("");
  }
}

/** Cells on a grid fixed to the page, `cell` centimetres a side, as a stem or a line is stepped into them. */
class Pixels {
  readonly #rows = new Map<number, Set<number>>();
  constructor(readonly cell: number) {}
  set(i: number, j: number): void {
    let row = this.#rows.get(j);
    if (!row) this.#rows.set(j, row = new Set());
    row.add(i);
  }
  *cells(): Generator<readonly [number, number]> {
    for (const [j, row] of this.#rows) for (const i of row) yield [i, j];
  }
  /** Lays the cells as pixels, each the colour `colourOf` gives it, in runs of one colour along each row. */
  lay(tiles: Tiles, course: Course, colourOf: (i: number, j: number) => string, opacity: number): void {
    for (const [j, row] of this.#rows) {
      const columns = [...row].sort((a, b) => a - b);
      for (let k = 0; k < columns.length;) {
        const colour = colourOf(columns[k]!, j);
        let end = k;
        while (end + 1 < columns.length && columns[end + 1] === columns[end]! + 1 && colourOf(columns[end + 1]!, j) === colour) end += 1;
        tiles.add(course, colour, opacity, this.cell, columns[k]!, j, end - k + 1, 1);
        k = end + 1;
      }
    }
  }
}

/** A polyline stepped into cells as wide as its width, with no gap where it runs aslant. */
function stepLine(points: readonly Pt[], width: number, pixels: Pixels): void {
  const cell = pixels.cell, radius = Math.max(0, width / 2 - cell / 2), reach = Math.ceil(radius / cell);
  for (let k = 0; k < points.length; k += 1) {
    const [ax, ay] = points[Math.max(0, k - 1)]!, [bx, by] = points[k]!;
    const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (cell / 2)));
    for (let step = k === 0 ? 0 : 1; step <= steps; step += 1) {
      const x = ax + (bx - ax) * step / steps, y = ay + (by - ay) * step / steps;
      const ci = Math.floor(x / cell), cj = Math.floor(y / cell);
      for (let di = -reach; di <= reach; di += 1) {
        for (let dj = -reach; dj <= reach; dj += 1) {
          if (Math.hypot((ci + di + 0.5) * cell - x, (cj + dj + 0.5) * cell - y) <= radius + cell / 2) pixels.set(ci + di, cj + dj);
        }
      }
    }
  }
}

/** A closed outline stepped into cells: its edge, so a stem thinner than a cell stays unbroken, and every cell inside. */
function stepRing(outline: readonly Pt[], pixels: Pixels): void {
  const first = outline[0];
  if (!first) return;
  stepLine([...outline, first], 0, pixels);
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
  for (const [x, y] of outline) {
    left = Math.min(left, x); right = Math.max(right, x);
    bottom = Math.min(bottom, y); top = Math.max(top, y);
  }
  const cell = pixels.cell, edges = new Edges([outline], cell);
  for (let j = Math.floor(bottom / cell); j * cell < top; j += 1) {
    for (let i = Math.floor(left / cell); i * cell < right; i += 1) {
      if (edges.inside((i + 0.5) * cell, (j + 0.5) * cell)) pixels.set(i, j);
    }
  }
}

/**
 * A body laid in tesserae. Each cell of the page's grid offers one, kept where the form reads lit enough: more
 * towards its rim, more the heavier the form, fewer in its shadow, where they lie dimmer. The cells' values come
 * from their place and the form, so the same form is always set alike.
 */
function tessellate(body: Body, colours: MosaicColours, tiles: Tiles): void {
  if (body.outline.length < 3) return;
  let left = Infinity, right = -Infinity, bottom = Infinity, top = -Infinity;
  for (const [x, y] of body.outline) {
    left = Math.min(left, x); right = Math.max(right, x);
    bottom = Math.min(bottom, y); top = Math.max(top, y);
  }
  const salt = Math.floor(variance(body) * 1e6), w = body.weight, middle = (left + right) / 2;
  const outline = new Edges([body.outline], LOOSE_REACH);
  const shadow = body.shadow.length > 0 ? new Edges(body.shadow, MOSAIC_SOFT) : null;
  // An accented form, a hip or a berry, keeps the accent; the rest take the light sweeping over the page.
  const colourAt = (x: number, y: number, jitter: number): string => body.tone === "accent" ? ACCENT : lightAt(colours, x, y, jitter);
  const shadeAt = (x: number, y: number): number => {
    if (!shadow) return 0;
    const edge = smoothstep(0, MOSAIC_SOFT, shadow.distance(x, y, MOSAIC_SOFT));
    return shadow.inside(x, y) ? 0.5 + 0.5 * edge : 0.5 - 0.5 * edge;
  };
  // Wide blocks of four cells, only where they lie wholly inside the form.
  const wide = TESSERA * 2;
  for (let J = Math.floor(bottom / wide); J * wide < top; J += 1) {
    for (let I = Math.floor(left / wide); I * wide < right; I += 1) {
      if (cellValue(I, J, salt + 7) >= BLOCK) continue;
      const x = (I + 0.5) * wide, y = (J + 0.5) * wide;
      if (!outline.inside(x, y) || outline.distance(x, y, LOOSE_REACH) < BLOCK_DEPTH + TESSERA) continue;
      tiles.add(Course.Block, colourAt(x, y, cellValue(I, J, salt + 8)), shadeAt(x, y) > 0.5 ? 0.35 : 0.55, TESSERA, 2 * I + 0.06, 2 * J + 0.06, 1.88, 1.88);
    }
  }
  for (let j = Math.floor((bottom - LOOSE_REACH) / TESSERA); j * TESSERA < top + LOOSE_REACH; j += 1) {
    for (let i = Math.floor((left - LOOSE_REACH) / TESSERA); i * TESSERA < right + LOOSE_REACH; i += 1) {
      const value = cellValue(i, j, salt), jitter = cellValue(i, j, salt + 1), size = cellValue(i, j, salt + 2);
      const x = (i + 0.5) * TESSERA, y = (j + 0.5) * TESSERA;
      if (outline.inside(x, y)) {
        const rim = 1 - smoothstep(0, MOSAIC_RIM, outline.distance(x, y, MOSAIC_RIM));
        const shade = shadeAt(x, y);
        if (value >= 0.42 + 0.25 * w + 0.5 * rim - 0.15 * shade) continue;
        const side = 0.7 + 0.24 * size, offset = (1 - side) * cellValue(i, j, salt + 3);
        if (rim > 0.6 && jitter < 0.22) tiles.add(Course.Lit, INK, 1, TESSERA, i + offset, j + offset, side, side);
        else tiles.add(Course.Tessera, colourAt(x, y, jitter), shade > 0.5 ? 0.5 : 0.85, TESSERA, i + offset, j + offset, side, side);
        continue;
      }
      // Beyond the form tesserae come loose, the fewer the further out, drifting sideways away from it.
      const distance = outline.distance(x, y, LOOSE_REACH);
      if (distance >= LOOSE_REACH || value >= LOOSE * (1 - distance / LOOSE_REACH)) continue;
      const away = x < middle ? -1 : 1, drift = away * Math.floor(jitter * 3), side = 0.4 + 0.3 * size;
      const colour = colourAt(x, y, jitter);
      tiles.add(Course.Tessera, colour, 0.75, TESSERA, i + drift + (1 - side) / 2, j + (1 - side) / 2, side, side);
      if (cellValue(i, j, salt + 4) < STREAK) {
        const length = 2 + Math.floor(cellValue(i, j, salt + 5) * (STREAK_REACH - 2));
        tiles.add(Course.Tessera, colour, 0.45, TESSERA, away > 0 ? i + drift + 1 : i + drift - length, j + 0.4, length, 0.2);
      }
    }
  }
  if (body.veins.length > 0) {
    const leading = new Pixels(PIXEL);
    for (const vein of body.veins) stepLine(vein, 0, leading);
    leading.lay(tiles, Course.Leading, () => PAPER, 0.85);
  }
}

/** A pane's side against the width of the form it stands for, and the smallest and largest side, in centimetres. */
const PANE_FILL = 1.6, PANE_LEAST = 0.24, PANE_MOST = 1.2;
/** How loosely a pane's colour follows the sweep: little, so its colours gather into regions of the page. */
const PANE_JITTER = 1;
/** The chance a pane drips light below it, and how many lit windows may lie about it, each as likely as WINDOW. */
const DRIP = 0.35, WINDOWS = 3, WINDOW = 0.4;
/** A lit window's side, in centimetres. */
const WINDOW_SIDE = 0.035;
/** How many chips of colour may lie about a pane, each as likely as CHIP, and their smallest and largest side, in centimetres. */
const CHIPS = 4, CHIP = 0.5, CHIP_SIDE = [0.03, 0.09] as const;
/** The cells a carreaux stem is broken into, in centimetres, the share that hold a square, and a square's side against its cell. */
const STEM_CELL = 0.1, STEM_KEPT = 0.7, STEM_SIDE = [0.5, 1.05] as const;
/** A salt for the values of a stem's cells, apart from any form's. */
const STEM_SALT = 0x7e11;

/** The corners of a square of side `side` centred on (x, y), turned by `angle` radians. */
function square(x: number, y: number, side: number, angle: number): Pt[] {
  const cos = Math.cos(angle) * side / 2, sin = Math.sin(angle) * side / 2;
  return [[x - cos + sin, y - sin - cos], [x + cos + sin, y + sin - cos], [x + cos - sin, y + sin + cos], [x - cos - sin, y - sin + cos]];
}

/**
 * A body abstracted into panes. Its long axis and its width come from the spread of its outline; panes wider than
 * the form are chained along that axis, each nudged, resized and turned any way at all (a square turned a quarter
 * is itself), and dimmer where it lies in the form's shadow. The values come from the form and each pane's place
 * in the chain, so the same form is always glazed alike.
 */
function glaze(body: Body, colours: MosaicColours, tiles: Tiles): void {
  const points = body.outline;
  if (points.length < 3) return;
  let cx = 0, cy = 0;
  for (const [x, y] of points) { cx += x; cy += y; }
  cx /= points.length; cy /= points.length;
  let xx = 0, yy = 0, xy = 0;
  for (const [x, y] of points) {
    xx += (x - cx) ** 2; yy += (y - cy) ** 2; xy += (x - cx) * (y - cy);
  }
  const axis = 0.5 * Math.atan2(2 * xy, xx - yy), ux = Math.cos(axis), uy = Math.sin(axis);
  let near = Infinity, far = -Infinity, low = Infinity, high = -Infinity;
  for (const [x, y] of points) {
    const along = (x - cx) * ux + (y - cy) * uy, across = (y - cy) * ux - (x - cx) * uy;
    near = Math.min(near, along); far = Math.max(far, along);
    low = Math.min(low, across); high = Math.max(high, across);
  }
  const length = far - near, side = clamp((high - low) * PANE_FILL, PANE_LEAST, PANE_MOST);
  const count = Math.max(1, Math.round(length / side));
  const salt = Math.floor(variance(body) * 1e6);
  const shadow = body.shadow.length > 0 ? new Edges(body.shadow, 0) : null;
  const accent = body.tone === "accent";
  for (let k = 0; k < count; k += 1) {
    const value = (draw: number): number => cellValue(k, draw, salt);
    const along = near + (k + 0.5) * length / count + (value(1) - 0.5) * 0.2 * side;
    const across = (low + high) / 2 + (value(2) - 0.5) * 0.2 * side;
    const x = cx + ux * along - uy * across, y = cy + uy * along + ux * across;
    const width = side * (0.85 + 0.3 * value(3)), half = width / 2;
    const colour = accent ? ACCENT : lightAt(colours, x, y, PANE_JITTER * value(5));
    const dim = shadow?.inside(x, y) ?? false;
    tiles.polygon(Course.Block, colour, dim ? 0.25 : 0.35 + 0.2 * value(6), square(x, y, width, value(4) * Math.PI / 2));
    // Light runs down from some panes, as a lit sign's colour runs down a wet street.
    if (value(7) < DRIP) {
      const drip = width * (0.12 + 0.3 * value(8)), drop = width * (0.5 + 1.5 * value(9));
      tiles.add(Course.Block, colour, 0.2, 1, x + (value(10) - 0.5) * 1.2 * half - drip / 2, y - half - drop, drip, drop);
    }
    for (let window = 0; window < WINDOWS; window += 1) {
      if (value(11 + window) >= WINDOW) continue;
      tiles.add(Course.Lit, INK, 1, 1, x + (value(14 + window) - 0.5) * 3.2 * half, y + (value(17 + window) - 0.5) * 3.2 * half, WINDOW_SIDE, WINDOW_SIDE);
    }
    for (let chip = 0; chip < CHIPS; chip += 1) {
      if (value(20 + chip) >= CHIP) continue;
      const chipX = x + (value(24 + chip) - 0.5) * 4 * half, chipY = y + (value(28 + chip) - 0.5) * 4 * half;
      tiles.polygon(Course.Tessera, accent ? ACCENT : lightAt(colours, chipX, chipY, PANE_JITTER * value(40 + chip)), 0.85,
        square(chipX, chipY, lerp(CHIP_SIDE[0], CHIP_SIDE[1], value(32 + chip)), value(36 + chip) * Math.PI / 2));
    }
  }
}

/** How a mosaic manner lays its light: its colours, how it lays a body, and how it lays the cells its stems and lines fall into. */
interface Glazing {
  readonly colours: MosaicColours;
  body(body: Body, colours: MosaicColours, tiles: Tiles): void;
  /** The side of the cells stems, lines and dots are stepped into, in centimetres. */
  readonly cell: number;
  stems(cells: Pixels, colours: MosaicColours, tiles: Tiles, accent: boolean): void;
}

/** Stems and lines stepped in pixels, light as the forms are, with sparks of ink along them. */
function stepped(cells: Pixels, colours: MosaicColours, tiles: Tiles, accent: boolean): void {
  cells.lay(tiles, Course.Tessera, accent ? () => ACCENT
    : (i, j) => cellValue(i, j, 0x5ba4c) < SPARK ? INK : lightAt(colours, (i + 0.5) * cells.cell, (j + 0.5) * cells.cell, 0), 1);
}

/**
 * Stems and lines broken into loose squares, one in most of the cells they pass through, each nudged and turned
 * any way. A square's values come from its cell, not from its order along the stem, so a stem growing through the
 * day keeps the squares it has shown.
 */
function scattered(cells: Pixels, colours: MosaicColours, tiles: Tiles, accent: boolean): void {
  const cell = cells.cell;
  for (const [i, j] of cells.cells()) {
    const value = (draw: number): number => cellValue(i, j, STEM_SALT + draw);
    if (value(0) >= STEM_KEPT) continue;
    const x = (i + 0.5 + (value(1) - 0.5) * 0.4) * cell, y = (j + 0.5 + (value(2) - 0.5) * 0.4) * cell;
    const spark = !accent && value(4) < SPARK;
    const colour = accent ? ACCENT : spark ? INK : lightAt(colours, x, y, PANE_JITTER * value(5));
    tiles.polygon(Course.Tessera, colour, accent || spark ? 1 : 0.55 + 0.35 * value(6),
      square(x, y, cell * lerp(STEM_SIDE[0], STEM_SIDE[1], value(3)), value(7) * Math.PI / 2));
  }
}

/** A mosaic painter after its glazing: it lays a whole motif at once, so each of its colours is one path. */
function mosaic(glazing: Glazing): (shapes: readonly Shape[]) => string {
  return shapes => {
    const tiles = new Tiles(), inked = new Pixels(glazing.cell), accented = new Pixels(glazing.cell);
    for (const shape of shapes) {
      const pixels = shape.tone === "accent" ? accented : inked;
      switch (shape.type) {
        case "body": glazing.body(shape, glazing.colours, tiles); break;
        case "solid": stepRing(shape.outline, pixels); break;
        case "line": stepLine(shape.points, shape.width, pixels); break;
        case "dots": for (const point of shape.points) stepLine([point], shape.radius * 2, pixels); break;
      }
    }
    glazing.stems(inked, glazing.colours, tiles, false);
    glazing.stems(accented, glazing.colours, tiles, true);
    return tiles.svg();
  };
}
const FOUR_INK_TESSERAE: Glazing = { colours: FOUR_INKS, body: tessellate, cell: PIXEL, stems: stepped };
const NEON_TESSERAE: Glazing = { colours: NEON, body: tessellate, cell: PIXEL, stems: stepped };
const PANES: Glazing = { colours: WINDOWSILL, body: glaze, cell: STEM_CELL, stems: scattered };

/** One glazing for every part of the plant. */
const everywhere = (glazing: Glazing): Readonly<Record<Part, Glazing>> => ({ bloom: glazing, leaf: glazing, stem: glazing, foot: glazing });

/** A mosaic manner's painters, glazing each part of the plant its own way. */
function glazed(parts: Readonly<Record<Part, Glazing>>): Pick<MannerStyle, "body" | "paint"> {
  const painters = new Map<Glazing, (shapes: readonly Shape[]) => string>();
  const painter = (glazing: Glazing): (shapes: readonly Shape[]) => string => {
    let paint = painters.get(glazing);
    if (!paint) painters.set(glazing, paint = mosaic(glazing));
    return paint;
  };
  const byPart: Readonly<Record<Part, (shapes: readonly Shape[]) => string>> = {
    bloom: painter(parts.bloom), leaf: painter(parts.leaf), stem: painter(parts.stem), foot: painter(parts.foot),
  };
  return {
    body: body => byPart.leaf([body]),
    paint: (shapes, _sheet, part) => byPart[part](shapes),
  };
}

/** A guest's square, in centimetres: the tessera's, so he is set on the garden's own grid, and how much of it the square fills. */
const FIGURE_PIXEL = TESSERA, FIGURE_FILL = 0.86;
/** How far squares are thrown off a guest, in centimetres, how fine the noise that throws them is, in cycles a centimetre, and how solid a thrown square is. */
const SCATTER = 1.1, SCATTER_GRAIN = 6, THROWN = 0.75;
/**
 * A trail of his squares left behind him, as a broken signal leaves a figure: how far behind it lies, in centimetres,
 * how coarse the noise that keeps some of it, in cycles a centimetre, and how sparsely that noise keeps it.
 */
const TRAIL = 0.5, TRAIL_GRAIN = 4, TRAIL_GAIN = 9, TRAIL_OFFSET = -5;

/**
 * A guest raised in squares: his engraving lit by the manner's colours running across him, a ragged fringe of him
 * thrown loose by noise, and the whole broken into squares on a grid, one sample of him to each square. The browser
 * takes the squares from the drawn figure, so the core never reads the engraving itself; the noise is seeded by the
 * garden, so a seed still draws the same guest.
 */
function pixelFigure(colours: MosaicColours): MannerStyle["figure"] {
  return (sheet, seed) => {
    const light = sheet.id("light"), filter = sheet.id("pixels");
    const last = colours.ramp.length - 1;
    const stops = colours.ramp.map((colour, k) => `<stop offset="${num(k / last)}" stop-color="${colour}"/>`).join("");
    // One dot sampled in each cell of the grid, then grown into the cell's square.
    const cell = FIGURE_PIXEL, dot = cell / 3, grow = (cell * FIGURE_FILL - dot) / 2;
    sheet.defs.push(`<linearGradient id="${light}" x1="0" y1="0" x2="1" y2="1">${stops}</linearGradient>`
      + `<filter id="${filter}" x="-50%" y="-50%" width="200%" height="200%" color-interpolation-filters="sRGB">`
      + `<feTurbulence type="fractalNoise" baseFrequency="${SCATTER_GRAIN}" numOctaves="1" seed="${seed % 1000}" result="noise"/>`
      + `<feDisplacementMap in="SourceGraphic" in2="noise" scale="${SCATTER}" xChannelSelector="R" yChannelSelector="G"/>`
      + `<feComponentTransfer result="thrown"><feFuncA type="linear" slope="${THROWN}"/></feComponentTransfer>`
      + `<feTurbulence type="fractalNoise" baseFrequency="${TRAIL_GRAIN}" numOctaves="1" seed="${(seed + 1) % 1000}"/>`
      + `<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${TRAIL_GAIN} ${TRAIL_OFFSET}" result="sparse"/>`
      + `<feOffset in="SourceGraphic" dx="${fine(-TRAIL)}" result="behind"/><feComposite in="behind" in2="sparse" operator="in" result="trail"/>`
      + `<feMerge result="whole"><feMergeNode in="trail"/><feMergeNode in="thrown"/><feMergeNode in="SourceGraphic"/></feMerge>`
      + `<feFlood x="${fine((cell - dot) / 2)}" y="${fine((cell - dot) / 2)}" width="${fine(dot)}" height="${fine(dot)}"/>`
      + `<feComposite x="0" y="0" width="${fine(cell)}" height="${fine(cell)}"/><feTile result="grid"/>`
      + `<feComposite in="whole" in2="grid" operator="in"/><feMorphology operator="dilate" radius="${fine(grow)}"/></filter>`);
    return { fill: `fill="url(#${light})"`, filter };
  };
}

/** What every screen manner shares: shapes in the page's frame, its inks for anything unglazed, and the glow. */
const SCREEN = {
  upright: true, solid: ` fill="${INK}"`, line: ` stroke="${INK}"`, dots: ` fill="${INK}"`, filter: glowFilter,
} as const;

/** The screen manners, each naming a glazing for each part of the plant and the light its guests are raised in. */
export const SCREEN_MANNERS: Readonly<Record<ScreenManner, MannerModule>> = {
  mosaique: { id: "mosaique", ...glazed(everywhere(FOUR_INK_TESSERAE)), figure: pixelFigure(FOUR_INKS), ...SCREEN },
  carreaux: { id: "carreaux", ...glazed(everywhere(PANES)), figure: pixelFigure(WINDOWSILL), ...SCREEN },
  // Fine tesserae where the plant's shape tells, in its leaves and its foot; panes for its blooms and stems.
  nekyia: { id: "nekyia", ...glazed({ bloom: PANES, leaf: NEON_TESSERAE, stem: PANES, foot: NEON_TESSERAE }), figure: pixelFigure(NEON), ...SCREEN },
};

/** How far a mosaic's light spreads round each tessera, in centimetres, and how strongly it glows. */
const GLOW = 0.07, GLOW_GAIN = 1.4;

/** Light on a dark screen: each tessera's glow spread soft round it, under the tesserae themselves. */
function glowFilter(sheet: Sheet): string {
  const id = sheet.id("glow");
  sheet.defs.push(`<filter id="${id}" x="-10%" y="-5%" width="120%" height="110%" color-interpolation-filters="sRGB">`
    + `<feGaussianBlur in="SourceGraphic" stdDeviation="${GLOW}"/><feComponentTransfer><feFuncA type="linear" slope="${GLOW_GAIN}"/></feComponentTransfer>`
    + `<feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>`);
  return id;
}
