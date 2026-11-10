// The festival of Opinion, the fourth complementary day. Fabre's report has a tribunal "tout-à-la-fois gaie &
// terrible" sit that day, at which every citizen may say what he likes of the men in office, in songs,
// caricatures and the salt of irony. Here the margin answers back: the plant grows as on any day, and then a
// cheeky hand goes over the engraving in red chalk. Its blooms and fruit get faces, with eyebrows and curled
// moustaches, a wig, a bonnet or a long nose; a leaf or two is struck out; an arrow points at the best of the
// caricatures; and a child's illegible running hand fills the open sky above the plant and, on a page, the room
// under the text, creeping onto the text block itself. It is the one day the margin writes on the text. A band's
// sky is a thin strip, so the hand writes one row along it, broken into lines, and two or three more lines where
// the plant leaves the band emptiest, as in a cul-de-lampe's open lower corners, with an arrow from one of them.
//
// The marks lie over everything, at layer 7 and above, in the accent ink. Each comes a little after what it
// sits on, and they come in as the day fills, as foliage does: the more the page writes, the more the margin
// writes back, though a face or two and a line of scrawl are there even on a quiet day. On a right-hand page
// the renderer mirrors every motif about its axis, so the marks are drawn mirrored to come out the right way round.
import type { FestivalContext, FestivalModule } from "../festival.js";
import { LAYER } from "../form.js";
import type { Garden, MotifItem } from "../garden.js";
import { clamp, type Pt, RAD, sample, bezier3 } from "../geometry.js";
import { createRng, type Rng } from "../random.js";
import type { Shape } from "../shapes.js";

/** The layers the marks lie at: writing under the faces, faces over it. */
const SCRAWL = 7, FACE = 7.5;
/** The width of the chalk's line, in centimetres. */
const CHALK = 0.026;
/** Room left at the canvas's edges. */
const EDGE = 0.25;

/** A hand-drawn line in red chalk. */
const chalk = (points: Pt[], width = CHALK): Shape => ({ type: "line", points, width, smooth: true, tone: "accent" });

/** Every point a set of shapes draws, to find a motif's extent. */
const pointsOf = (shapes: Shape[]): Pt[] =>
  shapes.flatMap(shape => shape.type === "body" ? shape.outline : shape.type === "solid" ? shape.outline : shape.points);

/** Shapes flipped about their axis, so that a mirrored garden draws them the right way round. */
const flipped = (shapes: Shape[]): Shape[] => shapes.map(shape => {
  const flip = (p: Pt): Pt => [-p[0], p[1]];
  if (shape.type === "body") return { ...shape, outline: shape.outline.map(flip), shadow: shape.shadow.map(r => r.map(flip)), grain: shape.grain.map(r => r.map(flip)), veins: shape.veins.map(r => r.map(flip)) };
  if (shape.type === "solid") return { ...shape, outline: shape.outline.map(flip) };
  return { ...shape, points: shape.points.map(flip) };
});

/**
 * A line of a child's running hand, from the origin along +x for about `length`, its baseline at y = 0: words of
 * loops of varying height, each letter one turn of a looped cycloid, with ascenders, descenders, the odd crossed
 * stroke and dotted i, on a baseline that wanders. The letters are `x` centimetres high.
 */
function scrawl(rng: Rng, length: number, x: number): Shape[] {
  const shapes: Shape[] = [];
  const slant = rng.range(0.15, 0.4);
  const drift = rng.sym(0.06) / Math.max(1, length);
  let at = rng.range(0, 0.15);
  while (at < length - x * 2) {
    const letters = Math.min(rng.int(2, 8), Math.floor((length - at) / (x * 0.9)));
    if (letters < 1) break;
    const word: Pt[] = [];
    const ticks: Pt[][] = [];
    for (let k = 0; k < letters; k += 1) {
      const kind = rng.u();
      const height = kind < 0.2 ? x * rng.range(2.2, 2.9) : kind < 0.3 ? -x * rng.range(1.4, 2) : x * rng.range(0.8, 1.15);
      const advance = x * rng.range(0.75, 1.05);
      const loop = advance * (height > x * 1.5 || height < 0 ? rng.range(0.55, 0.8) : rng.range(0.05, 0.5));
      const steps = 9;
      for (let j = k === 0 ? 0 : 1; j <= steps; j += 1) {
        const th = j / steps * Math.PI * 2;
        const lx = at + advance * th / (Math.PI * 2) - loop * Math.sin(th);
        const ly = height * (1 - Math.cos(th)) / 2;
        word.push([lx + ly * slant, ly + lx * drift + rng.sym(x * 0.06)]);
      }
      if (kind > 0.93) ticks.push([[at + x * 0.2 + x * 1.2 * slant, x * 1.6], [at + x * 0.4 + x * 1.6 * slant, x * 1.62]]);
      else if (kind > 0.86) ticks.push([[at + x * 0.3 + x * 1.7 * slant, x * 1.7], [at + x * 0.33 + x * 1.75 * slant, x * 1.76]]);
      at += advance;
    }
    // A final stroke flicks up off the last letter.
    const last = word[word.length - 1]!;
    word.push([last[0] + x * 0.35, last[1] + x * rng.range(0.2, 0.6)]);
    shapes.push(chalk(word), ...ticks.map(tick => chalk(tick, CHALK * 0.9)));
    at += x * rng.range(0.9, 1.8);
  }
  return shapes;
}

/** A curl of moustache from the lip outwards on one side, rolling up into a spiral at its end. */
function moustache(rng: Rng, s: number, side: 1 | -1, curl: number): Pt[] {
  const reach = s * rng.range(0.38, 0.5);
  const points = sample(bezier3([side * s * 0.03, -s * 0.12], [side * s * 0.15, -s * 0.06], [side * reach * 0.7, -s * 0.24], [side * reach, -s * 0.1]), 8);
  const c: Pt = [side * (reach - s * 0.03 * curl), -s * 0.1 + s * 0.06 * curl];
  const r0 = s * 0.06 * curl;
  for (let k = 1; k <= 10; k += 1) {
    const th = -Math.PI / 2 + k / 10 * Math.PI * 1.6;
    const r = r0 * (1 - k / 14);
    points.push([c[0] + side * Math.cos(th) * r, c[1] + Math.sin(th) * r]);
  }
  return points;
}

/** A caricature's face, `s` centimetres across, centred on the origin, upright; `look` chooses its fancy. */
function face(rng: Rng, s: number, look: number): Shape[] {
  const shapes: Shape[] = [];
  const eye = s * rng.range(0.16, 0.24);
  const eyeY = s * rng.range(0.1, 0.18);
  const squint = rng.chance(0.3);
  if (squint) shapes.push(chalk([[-eye - s * 0.06, eyeY], [-eye + s * 0.06, eyeY + rng.sym(s * 0.02)]]));
  shapes.push({ type: "dots", points: squint ? [[eye, eyeY]] : [[-eye, eyeY], [eye, eyeY]], radius: s * 0.035, tone: "accent" });
  // Eyebrows, raised in surprise or knitted in a frown.
  const frown = rng.sym(1);
  for (const side of [-1, 1] as const) {
    shapes.push(chalk([[side * (eye - s * 0.09), eyeY + s * (0.12 - 0.05 * frown)], [side * eye, eyeY + s * 0.15], [side * (eye + s * 0.1), eyeY + s * (0.12 + 0.05 * frown)]]));
  }
  // The nose: a hook, or on the long-nosed a great beak out to one side.
  const long = look % 5 === 2;
  shapes.push(chalk(long
    ? [[0, eyeY - s * 0.02], [s * 0.35, -s * 0.06], [s * 0.42, -s * 0.12], [s * 0.05, -s * 0.08]]
    : [[0, eyeY - s * 0.03], [s * 0.05, -s * 0.03], [-s * 0.02, -s * 0.06]]));
  const curl = rng.range(0.7, 1.3);
  shapes.push(chalk(moustache(rng, s, -1, curl), CHALK * 1.8), chalk(moustache(rng, s, 1, curl), CHALK * 1.8));
  // A grin under the moustache, or a goatee.
  if (rng.chance(0.5)) shapes.push(chalk(sample(bezier3([-s * 0.12, -s * 0.24], [-s * 0.05, -s * 0.31], [s * 0.05, -s * 0.31], [s * 0.12, -s * 0.24]), 6)));
  else shapes.push(chalk([[-s * 0.04, -s * 0.24], [0, -s * 0.42], [s * 0.04, -s * 0.24]]));
  const top = eyeY + s * 0.24;
  switch (look % 5) {
    case 0: {
      // A magistrate's wig: rolls of curls down either side.
      for (const side of [-1, 1] as const) for (let k = 0; k < 3; k += 1) {
        const c: Pt = [side * s * 0.46, top - s * 0.16 - k * s * 0.15];
        shapes.push(chalk(Array.from({ length: 11 }, (_, j): Pt => {
          const th = j / 10 * Math.PI * 2;
          return [c[0] + Math.cos(th) * s * 0.07, c[1] + Math.sin(th) * s * 0.06];
        })));
      }
      shapes.push(chalk(sample(bezier3([-s * 0.46, top - s * 0.05], [-s * 0.3, top + s * 0.2], [s * 0.3, top + s * 0.2], [s * 0.46, top - s * 0.05]), 8)));
      break;
    }
    case 1: {
      // The bonnet rouge, its point falling forward, with a cockade.
      shapes.push(chalk([[-s * 0.32, top], [-s * 0.28, top + s * 0.3], [s * 0.05, top + s * 0.42], [s * 0.3, top + s * 0.22], [s * 0.18, top + s * 0.08], [s * 0.32, top], [-s * 0.32, top]], CHALK * 1.2));
      shapes.push({ type: "dots", points: [[-s * 0.2, top + s * 0.08]], radius: s * 0.05, tone: "accent" });
      break;
    }
    case 3: {
      // A cocked hat, the bicorne, worn crosswise.
      shapes.push(chalk([[-s * 0.55, top], [-s * 0.2, top + s * 0.08], [0, top + s * 0.3], [s * 0.2, top + s * 0.08], [s * 0.55, top], [-s * 0.55, top]], CHALK * 1.2));
      break;
    }
    case 4: {
      // A quizzing glass on one eye, its ribbon trailing.
      const c: Pt = [eye, eyeY];
      shapes.push(chalk(Array.from({ length: 13 }, (_, j): Pt => [c[0] + Math.cos(j / 12 * Math.PI * 2) * s * 0.1, c[1] + Math.sin(j / 12 * Math.PI * 2) * s * 0.1])));
      shapes.push(chalk([[c[0] + s * 0.1, c[1]], [c[0] + s * 0.2, c[1] - s * 0.2], [c[0] + s * 0.12, c[1] - s * 0.45]], CHALK * 0.8));
      break;
    }
    default:
      // A few hairs standing up on end.
      for (let k = -2; k <= 2; k += 1) shapes.push(chalk([[k * s * 0.07, top - s * 0.05], [k * s * 0.09 + rng.sym(s * 0.03), top + s * rng.range(0.1, 0.2)]]));
  }
  return shapes;
}

/** An arrow from the origin to `to`, with a quick wavering shaft and an open head. */
function arrow(rng: Rng, to: Pt): Shape[] {
  const len = Math.hypot(to[0], to[1]);
  const [ux, uy] = [to[0] / len, to[1] / len];
  const bow = rng.sym(0.25) * len;
  const shaft = sample(bezier3([0, 0], [to[0] * 0.3 - uy * bow, to[1] * 0.3 + ux * bow], [to[0] * 0.7 - uy * bow, to[1] * 0.7 + ux * bow], to), 10);
  const before = shaft[shaft.length - 2]!;
  const [dx, dy] = [to[0] - before[0], to[1] - before[1]];
  const dl = Math.hypot(dx, dy) || 1;
  const head = 0.22;
  const wing = (a: number): Pt => {
    const c = Math.cos(a), sn = Math.sin(a);
    return [to[0] - head * (dx * c - dy * sn) / dl, to[1] - head * (dx * sn + dy * c) / dl];
  };
  return [chalk(shaft), chalk([wing(28 * RAD), to, wing(-28 * RAD)])];
}

/** A zigzag rature struck through a leaf, along its axis, `s` long. */
function rature(rng: Rng, s: number): Shape[] {
  const n = rng.int(5, 8);
  const points = Array.from({ length: n + 1 }, (_, k): Pt => [(k % 2 ? 1 : -1) * s * rng.range(0.15, 0.25), s * (0.1 + 0.8 * k / n)]);
  return [chalk(points, CHALK * 1.2)];
}

function grow(context: FestivalContext): Garden {
  const { rng, ground, spec, ornament } = context;
  const garden = context.grow();
  const { mirrored, width: canvas, height: H } = garden;
  const [cx0, , cx1] = garden.column;
  const items: MotifItem[] = [];
  const seed = (): number => Math.floor(rng.u() * 4294967295);
  /** A mark, drawn upright in its own frame at `at`, pre-mirrored on a right-hand page. */
  const mark = (name: string, layer: number, at: Pt, born: number, rank: number, draw: (r: Rng) => Shape[]): void => {
    items.push({
      kind: "motif", order: 0, layer, name, at, angle: 90, size: 1, seed: seed(), born: clamp(born, 0, 1), staged: false, seedAt: 2,
      leafRank: clamp(rank, 0, 0.99), draw: r => mirrored ? flipped(draw(r)) : draw(r),
    });
  };

  // What there is to deface: the blooms and fruit, or failing two big enough, whatever else the plant shows, as
  // the amadouvier's brackets. Each is drawn once to find where its head is on the canvas and how big it is.
  const motifs = garden.items.filter((item): item is MotifItem => item.kind === "motif");
  const measure = (chosen: MotifItem[]) => chosen.map(item => {
    const a = (item.angle - 90) * RAD;
    const drawn = pointsOf(item.draw(createRng(item.seed), item.size, item.staged ? "bloom" : "seed")).map(([lx, ly]): Pt => {
      const x = mirrored ? -lx : lx;
      return [item.at[0] + x * Math.cos(a) - ly * Math.sin(a), item.at[1] + x * Math.sin(a) + ly * Math.cos(a)];
    });
    const xs = drawn.map(p => p[0]), ys = drawn.map(p => p[1]);
    const [x0, x1, y0, y1] = drawn.length ? [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] : [item.at[0], item.at[0], item.at[1], item.at[1]];
    const span = Math.min(x1 - x0, y1 - y0);
    // A mark on foliage comes in no sooner than the leaf it sits on, as the day fills.
    return { born: item.born + (item.staged ? 0.14 : 0.08), centre: [(x0 + x1) / 2, (y0 + y1) / 2] as Pt, span, main: item.name === "terminal", rank: item.leafRank ?? 0 };
  }).filter(s => s.span > 0.35);
  let sitters = measure(motifs.filter(item => item.layer >= LAYER.bloom));
  // A plant whose fruit grows on its foot, as the amadouvier's brackets up their dead birch, has its faces there:
  // each modelled form of a fruit's size the foot draws at the end of a full day, coming when the foot first shows it.
  const foot = garden.foot;
  if (sitters.length < 2 && foot) {
    // The foot is drawn for its own column, scaled and lowered where the garden puts it.
    const columnSize = { width: foot.width, height: (H + foot.drop) / foot.scale };
    const forms = (t: number) => foot.draw(createRng(foot.seed), columnSize, t, 1).flatMap(shape => {
      if (shape.type !== "body") return [];
      const xs = shape.outline.map(p => foot.x + p[0] * foot.scale), ys = shape.outline.map(p => p[1] * foot.scale - foot.drop);
      const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
      return x1 - x0 > 0.5 && x1 - x0 < 2.5 && y1 - y0 > 0.35 && y1 - y0 < 2 ? [{ centre: [(x0 + x1) / 2, (y0 + y1) / 2] as Pt, span: Math.min(x1 - x0, y1 - y0) }] : [];
    });
    const moments = Array.from({ length: 21 }, (_, k) => ({ t: k / 20, shown: forms(k / 20) }));
    for (const form of forms(1)) {
      const first = moments.find(m => m.shown.some(o => Math.hypot(o.centre[0] - form.centre[0], o.centre[1] - form.centre[1]) < 0.3));
      sitters.push({ born: (first?.t ?? 1) + 0.08, ...form, main: false, rank: 0 });
    }
  }
  if (sitters.length < 2) sitters.push(...measure(motifs.filter(item => item.layer < LAYER.bloom)));
  sitters.sort((p, q) => Number(q.main) - Number(p.main) || q.span - p.span);
  // A few faces, bigger than what they sit on as a caricature is, and none crowding another.
  const faces: { centre: Pt; size: number; born: number; rank: number }[] = [];
  for (const sitter of sitters) {
    if (faces.length >= 8) break;
    const size = clamp(sitter.span * 1.8, 1, 1.8);
    if (faces.some(f => Math.hypot(f.centre[0] - sitter.centre[0], f.centre[1] - sitter.centre[1]) < (f.size + size) * 0.8)) continue;
    const half = size * 0.6;
    const centre: Pt = [clamp(sitter.centre[0], half + EDGE, canvas - half - EDGE), clamp(sitter.centre[1], half, H - half)];
    const born = sitter.born + rng.range(0, 0.05);
    faces.push({ centre, size, born, rank: sitter.rank });
  }
  faces.forEach((f, k) => {
    const look = rng.int(0, 4);
    mark("caricature", FACE, f.centre, f.born, Math.max(f.rank, k < 2 ? 0.08 + k * 0.12 : rng.range(0.3, 0.95)), r => face(r, f.size, look));
  });

  // A leaf or two struck through.
  const leaves = motifs.filter(item => item.layer === LAYER.leaf && item.size > 0.6);
  for (let k = 0, n = Math.min(leaves.length, rng.int(1, 2)); k < n; k += 1) {
    const leaf = rng.pick(leaves);
    items.push({
      kind: "motif", order: 0, layer: SCRAWL, name: "rature", at: leaf.at, angle: leaf.angle, size: leaf.size, seed: seed(),
      born: clamp(leaf.born + 0.2, 0, 0.98), staged: false, seedAt: 2, leafRank: Math.max(leaf.leafRank ?? 0, rng.range(0.45, 0.9)), draw: (r, s) => rature(r, s),
    });
  }

  // The running hand. Lines fill the sky over the column, or run along a band's thin sky; on a page two or three
  // lines find the emptiest bands of the room under the text, which the plant's arcs fill, and two or three more,
  // one of them slanting across, write on the text block itself, coming in last and only on a full day. A band
  // has its emptiest places written in as a page's room is.
  const lines: { x0: number; x1: number; y: number; rank: number; tilt: number }[] = [];
  const [sx0, sx1] = [cx0 + EDGE, cx1 - EDGE];
  if (!ornament) {
    const rows: number[] = [];
    for (let y = ground + 0.35 + rng.range(0, 0.15); y < H - 0.5; y += rng.range(0.42, 0.6)) if (rng.chance(0.85)) rows.push(y);
    rows.forEach((y, k) => {
      const x = sx0 + rng.range(0, (sx1 - sx0) * 0.2);
      const end = sx1 - rng.range(0, (sx1 - sx0) * 0.35);
      if (end - x > 0.8) lines.push({ x0: x, x1: end, y, rank: 0.05 + 0.9 * (k + rng.u()) / rows.length, tilt: 0 });
    });
  } else {
    const y = ground + 0.2 + rng.range(0, 0.1);
    const runs: [number, number][] = [];
    for (let x = sx0 + rng.range(0, 1.5); x < sx1 - 1.5;) {
      const end = Math.min(sx1, x + rng.range(2.5, 5));
      runs.push([x, end]);
      x = end + rng.range(1, 3);
    }
    runs.forEach(([x0, x1], k) => lines.push({ x0, x1, y, rank: 0.05 + 0.9 * (k + rng.u()) / runs.length, tilt: 0 }));
  }
  /** Up to three lines in the emptiest bands of the room [x0, x1] × [y0, y1], measured against what the garden already draws there. */
  const emptiest = (x0: number, x1: number, y0: number, y1: number): { x0: number; x1: number; y: number }[] => {
    // What the garden already draws: stem points, and each motif as a disc about its place.
    const crowd: [number, number, number][] = garden.items.flatMap((item): [number, number, number][] =>
      item.kind === "stem" ? item.points.filter((_, k) => k % 2 === 0).map(([x, y]): [number, number, number] => [x, y, 0.1])
        : [[item.at[0], item.at[1], item.size * 0.6]]);
    const candidates: { x0: number; x1: number; y: number; score: number }[] = [];
    for (let y = y0; y < y1; y += 0.3) for (let x = x0; x < x1 - 2.5; x += 0.8) {
      const end = Math.min(x1, x + rng.range(2.5, 4.5));
      const score = crowd.filter(([px, py, r]) => px + r > x - 0.2 && px - r < end + 0.2 && py + r > y - 0.25 && py - r < y + 0.5).length;
      candidates.push({ x0: x, x1: end, y, score });
    }
    candidates.sort((p, q) => p.score - q.score);
    const room: typeof candidates = [];
    for (const c of candidates) {
      if (room.length >= 3 || c.score > 2) break;
      if (room.some(o => Math.abs(o.y - c.y) < 0.6)) continue;
      room.push(c);
    }
    return room;
  };
  const roomLines = (room: { x0: number; x1: number; y: number }[]): void =>
    room.forEach((c, k) => lines.push({ x0: c.x0, x1: c.x1, y: c.y, rank: 0.2 + 0.25 * k + rng.range(0, 0.15), tilt: 0 }));
  if (ornament) roomLines(emptiest(sx0, sx1, 0.5, ground - 0.5));
  const page = spec.page;
  if (page) {
    const [tx0, tx1] = page.side === "left" ? [cx1 + 0.4, canvas - EDGE] : [EDGE, cx0 - 0.4];
    roomLines(emptiest(tx0, tx1, 0.5, page.below - 0.5));
    const written = rng.int(2, 3);
    for (let k = 0; k < written; k += 1) {
      const x = tx0 + rng.range(0.3, (tx1 - tx0) * 0.4);
      const end = Math.min(tx1, x + rng.range(2.5, 5));
      if (end - x > 1 && H - page.below > 3.5) {
        lines.push({ x0: x, x1: end, y: rng.range(page.below + 1.5, H - 1.5), rank: 0.75 + 0.24 * (k + rng.u()) / written, tilt: k === 0 ? rng.sym(1) * 8 + (rng.chance(0.5) ? 6 : -6) : 0 });
      }
    }
  }
  lines.forEach(line => {
    const x = rng.range(0.11, 0.15);
    const length = line.x1 - line.x0;
    const [c, s] = [Math.cos(line.tilt * RAD), Math.sin(line.tilt * RAD)];
    mark("scrawl", SCRAWL, [line.x0, line.y], 0.25 + 0.7 * line.rank, line.rank, r => line.tilt === 0 ? scrawl(r, length, x)
      : scrawl(r, length, x).map(shape => shape.type === "line" ? { ...shape, points: shape.points.map(([px, py]): Pt => [px * c - py * s, px * s + py * c]) } : shape));
  });

  // An arrow from the end of a line of scrawl in the sky down to the highest caricature, as if the writing were
  // about it. A band's sky is too close over its caricatures, so there the arrow leaves the end of a line, those
  // in the band's empty places first, for the nearest caricature it can point at from there.
  if (!ornament) {
    const target = faces.reduce<typeof faces[number] | undefined>((best, f) => best && best.centre[1] >= f.centre[1] ? best : f, undefined);
    const from = lines.find(line => line.y > ground);
    if (target && from) {
      const tail: Pt = [clamp(target.centre[0] + rng.sym(1), cx0 + EDGE + 0.3, cx1 - EDGE - 0.3), from.y - 0.15];
      const to: Pt = [target.centre[0] - tail[0], target.centre[1] + target.size * 0.65 - tail[1]];
      if (to[1] < -0.5 && Math.hypot(to[0], to[1]) < 5) mark("arrow", SCRAWL, tail, Math.max(target.born, 0.25 + 0.7 * from.rank) + 0.03, Math.max(from.rank, 0.12) + 0.01, r => arrow(r, to));
    }
  } else {
    for (const from of [...lines].reverse()) {
      let best: { tail: Pt; to: Pt; born: number } | null = null;
      for (const end of [from.x0 - 0.15, from.x1 + 0.15]) for (const f of faces) {
        const tail: Pt = [end, from.y + 0.1];
        const away = Math.hypot(f.centre[0] - tail[0], f.centre[1] - tail[1]);
        const reach = away - f.size * 0.6;
        if (reach < 0.8 || reach > 4 || (best && reach >= Math.hypot(...best.to))) continue;
        const share = reach / away;
        best = { tail, to: [(f.centre[0] - tail[0]) * share, (f.centre[1] - tail[1]) * share], born: f.born };
      }
      if (!best) continue;
      const { tail, to, born } = best;
      mark("arrow", SCRAWL, tail, Math.max(born, 0.25 + 0.7 * from.rank) + 0.03, Math.max(from.rank, 0.12) + 0.01, r => arrow(r, to));
      break;
    }
  }

  // The marks are numbered after the plant's items.
  let order = garden.items.length;
  for (const item of items) item.order = order++;
  return { ...garden, items: [...garden.items, ...items] };
}

export const festival: FestivalModule = { id: "opinion", grow };
