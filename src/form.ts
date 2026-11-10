// What a plant form is. A form names what a plant is made of (its leaves, its bloom and what the bloom
// becomes) and how it stands; the growth loop decides where things go. Each form lives in its own module
// under forms/, named `<id>.form.ts`, exports `form: FormModule`, and is listed in registry.ts. A variant
// tunes a form for one plant of the calendar (a pear rather than a fig, an umbel rather than a corymb),
// so that two plants of one form still look like themselves.
import type { Rect } from "./field.js";
import type { Pt } from "./geometry.js";
import type { Rng } from "./random.js";
import type { Shape } from "./shapes.js";

/** A staged motif is a bud when it appears, opens, and goes to seed as the day nears its end. */
export type Stage = "bud" | "bloom" | "seed";

export const LAYER = { stem: 2, leaf: 3, airy: 4, bloom: 5 } as const;

export interface MotifRow {
  name: string;
  w: number;
  smin: number;
  smax: number;
  max: number;
  hard?: boolean;
  layer: number;
  upright?: number;
  staged?: boolean;
  /** Proxy radius at size s. */
  r(s: number): number;
  /** Distance from the proxy's centre back to the primitive's origin, along its axis. */
  off(s: number): number;
  /** Draws in the motif's frame: origin at its base, axis along +y, final size in centimetres. */
  draw(rng: Rng, s: number, stage: Stage): Shape[];
  /**
   * One of the petals this bloom sheds as it goes to seed, for a bloom of size `s`: drawn in its own frame, base at
   * the origin and tip along +y, in centimetres. A bloom without it sheds none.
   */
  petal?(rng: Rng, s: number): Shape[];
}

/**
 * What a plant grows out of, drawn at the column's foot: a root study under its soil line, a stump, a
 * bed of strata. The main stems leave it at its crown, and leaves, blooms and the guest keep clear of the
 * room it fills. A foot with no main stems above it is the whole garden.
 */
export interface Foot {
  /** Where the main stems leave the foot: x as a share of the column's width, y in centimetres above the paper's foot. */
  crown: readonly [x: number, y: number];
  /** The parts of the column the foot fills, as [x0, y0, x1, y1] with x as shares of the width and y in centimetres. */
  room: readonly Rect[];
  /** Whether the main stems' root curls into a scroll at the crown, as it does on bare ground. */
  scroll: boolean;
  /**
   * Draws the foot in the garden's centimetres, +y up, at moment `t` of the day (0 at its start, 1 at its
   * end) and the day's `fullness` (0 empty, 1 full). Like the rest of the garden it never takes
   * back what it has shown as either grows: what time brings stays, what fullness brings stays.
   */
  draw(rng: Rng, column: { width: number; height: number }, t: number, fullness: number): Shape[];
}

/**
 * Draws a stem in place of the plain inked ribbon: a mycelial thread, a barked snag. It receives the part
 * grown so far (`points`, from the stem's base) and the stem's full width at a share `u` of that part, and
 * draws in the garden's centimetres. Anything it scatters along the stem is keyed to distance from the
 * base, so a growing stem keeps what it has shown.
 */
export type StemInk = (rng: Rng, points: readonly Pt[], width: (u: number) => number, main: boolean) => Shape[];

export interface PlantForm {
  id: string;
  /** The main stems; a form with a foot may have none, and its foot is then the whole garden. */
  stems: { count: number; amplitude: number; lambda: [number, number]; width: number; tops: number[] };
  /** What the plant grows out of, if not bare ground. */
  foot?: Foot;
  /** How the stems are inked, if not as plain tapered ribbons. */
  stemInk?: StemInk;
  /** Leaves fanning from the root, as a rosette. */
  basal: { count: [number, number]; length: [number, number] } | null;
  nodes: { every: [number, number]; length: (height: number) => number; angle: [number, number]; below: number };
  /** Proxy radius of a node leaf as a share of its length: narrow leaves pack closer. */
  leafProxy: number;
  leaf(rng: Rng, length: number, bend: number): Shape[];
  leaflet(rng: Rng, length: number, bend: number): Shape[];
  terminal: { size: [number, number]; r(s: number): number; off(s: number): number; draw(rng: Rng, s: number, stage: Stage): Shape[]; petal?(rng: Rng, s: number): Shape[] };
  motifs: MotifRow[];
  /**
   * What the fruit leaves once its seed has fallen, such as the chestnut's empty burr, drawn in the motif's
   * frame at size `s`. The festival of Virtue hangs it at the stem's end, where the bloom was.
   */
  husk?(rng: Rng, s: number): Shape[];
  /**
   * One seed alone, such as a chestnut out of its burr, drawn in the motif's frame with its base at the origin
   * and the tip it germinates from at (0, s). The festival of the Revolution leaves it in the middle of the page.
   */
  kernel?(rng: Rng, s: number): Shape[];
}

export type VariantValue = string | number | boolean;
export type Variant = Readonly<Record<string, VariantValue>>;

export interface VariantKey {
  doc: string;
  default: VariantValue;
  /** The allowed values of a choice; absent for a number, which `range` bounds. */
  values?: readonly VariantValue[];
  range?: readonly [number, number];
}

export interface FormModule {
  /** The form's id, in lowercase ASCII and hyphens: "epi-aromatique". */
  id: string;
  /** The form's name as written in French, for display: "épi aromatique". */
  name: string;
  /** One line on what the form draws. */
  doc: string;
  variants: Readonly<Record<string, VariantKey>>;
  /** Plants of the calendar drawn with this form, for the gallery. */
  examples: readonly { name: string; variant: Variant }[];
  build(variant: Variant): PlantForm;
}

/** The variant with every key the form knows filled in, refusing unknown keys and values out of bounds. */
export function resolveVariant(module: FormModule, variant: Variant = {}): Variant {
  const resolved: Record<string, VariantValue> = {};
  for (const key of Object.keys(variant)) if (!(key in module.variants)) throw new Error(`form ${module.id} has no variant key ${key}`);
  for (const [key, spec] of Object.entries(module.variants)) {
    const value = variant[key] ?? spec.default;
    if (spec.values && !spec.values.includes(value)) throw new Error(`form ${module.id}: ${key} cannot be ${String(value)}`);
    if (spec.range && (typeof value !== "number" || value < spec.range[0] || value > spec.range[1])) throw new Error(`form ${module.id}: ${key} must lie in ${spec.range.join("..")}`);
    resolved[key] = value;
  }
  return resolved;
}

/** A variant's value as a number, a string or a flag, for form builders. */
export const numberOf = (variant: Variant, key: string): number => Number(variant[key]);
export const textOf = (variant: Variant, key: string): string => String(variant[key]);
export const flagOf = (variant: Variant, key: string): boolean => variant[key] === true;
