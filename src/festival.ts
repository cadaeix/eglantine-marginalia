// The festivals of the complementary days. Fabre d'Églantine gave the days after the year's twelve months,
// five of them and six in a sextile year, festivals rather than plants: Virtue, Genius, Labour, Opinion and
// Rewards, and in a sextile year the Revolution. A festival names no plant, so here it does something to
// one: it strips the plant to its stem, stakes it on a quill, binds it in a sheaf, scribbles over it,
// crowns it, or leaves a single seed of it. The calendar gives each complementary day its festival and the
// year's last plant; a page can hold a festival for any plant.
//
// Each festival grows in its own module under festivals/, exporting `festival: FestivalModule`, from a context
// the growth loop hands it, so the modules load no forms and import nothing from the loop but its types. Like
// the forms, they are listed by hand twice: in registry.ts for the main entry, and in load-festival.ts, which
// loads one at a time for the light entry, so a page carries no festival it does not hold.
import type { Foot, PlantForm } from "./form.js";
import type { Garden, GardenItem, GrowSpec, Ornament } from "./garden.js";
import type { Pt } from "./geometry.js";
import type { Rng } from "./random.js";

/** The festivals in the order of the complementary days; the revolution's falls only in a sextile year. */
export const FESTIVALS = ["vertu", "genie", "travail", "opinion", "recompenses", "revolution"] as const;
export type Festival = typeof FESTIVALS[number];

/**
 * Lays main stem `k` from the root up to the height `top`, with points about 0.25 cm apart, in place of `laid`, the
 * stem the loop lays itself, which a festival may follow, bend or set aside.
 */
export type MainsShaping = (k: number, root: Pt, top: number, laid: readonly Pt[]) => Pt[];

/** What a festival grows from: the plant, the spec without its festival or guest, and the growth loop's two ways of laying out a garden. */
export interface FestivalContext {
  readonly form: PlantForm;
  /** The spec the garden is grown from, without its festival or guest: a festival garden has no guest. */
  readonly spec: GrowSpec;
  /** The column, in centimetres, or the band of a bandeau or a cul-de-lampe. */
  readonly width: number;
  readonly height: number;
  /** The printer's ornament the garden grows as, or null for a margin's column. */
  readonly ornament: Ornament | null;
  /** The height below the column's open sky, which the plant leaves empty above it. */
  readonly ground: number;
  /**
   * How wide the loop draws the plant's foot here, in centimetres: the column's width, a bed's band, or the column's
   * width a cul-de-lampe centres under its root. A foot's crown and room give x as shares of it.
   */
  readonly footWidth: number;
  /** The festival's own stream, apart from the plant's, seeded from the garden's seed. */
  readonly rng: Rng;
  /**
   * The plant's ordinary garden. With `page: false` it is grown in the column alone, whatever the spec's page;
   * `form` grows another form in its place, and `mains` lays its main stems.
   */
  grow(options?: { page?: boolean; form?: PlantForm; mains?: MainsShaping }): Garden;
  /**
   * A garden of items laid out in the column, set on the page beside it when the spec has one. Their order,
   * the moments staged motifs go to seed and the ranks foliage comes in by are given here, as the growth loop
   * gives them; a motif outside the leaf layer keeps any rank it carries. `mains` are the main stems' centrelines,
   * and `foot` draws what the plant stands on at the column's foot, as a form's foot does.
   */
  compose(items: GardenItem[], options?: { mains?: Pt[][]; foot?: Foot["draw"] }): Garden;
}

/** A festival as its module exports it: its id and the garden it grows. */
export interface FestivalModule {
  readonly id: Festival;
  grow(context: FestivalContext): Garden;
}
