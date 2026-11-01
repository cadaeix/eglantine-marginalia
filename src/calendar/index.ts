// A plant for every day: the French Republican calendar's day names, read as a garden. Each day of a
// month is named for a plant, except the quintidi, named for an animal, and the décadi, named for a tool.
// On those days the garden grows the day before's plant, and the animal visits it or the tool lies at rest
// at its foot. The complementary days at the year's end have no plant.
import type { Variant } from "../form.js";
import { FIGURES } from "./figures.js";
import { COMPLEMENTARY, DAYS, MONTHS } from "./names.js";
import { PLANTS } from "./plants.js";
import { type RepublicanDate, republicanDate, roman } from "./republican.js";

export { localDate, type RepublicanDate, republicanDate, roman } from "./republican.js";
export { COMPLEMENTARY, DAYS, MONTHS } from "./names.js";
export { PLANTS, type PlantRow } from "./plants.js";
export { FIGURES, type FigureRow } from "./figures.js";

/** A figure's size in the 6 × 22 cm column, in centimetres: an animal's height, a tool's length. */
export const FIGURE_SIZE = { visitor: 1.4, rest: 3.2 } as const;

/** The day's animal or tool as a garden's guest; it can be passed to `growGarden` as it is. */
export interface CalendarGuest {
  readonly kind: "visitor" | "rest";
  /** "l'âne", "la charrue". */
  readonly name: string;
  /** The figure's file name in figures/, without its extension. */
  readonly figure: string;
  /** Width over height. */
  readonly aspect: number;
  /** Height for an animal, length for a tool, in centimetres. */
  readonly size: number;
}

export interface CalendarDay {
  readonly date: RepublicanDate;
  /** "8 brumaire an CCXXXV", "1er vendémiaire an CCXXXVI", or "jour de la vertu, an CCXXXV". */
  readonly dateline: string;
  /** The day's name as a noun with its article: "la scorsonère", "l'âne"; a complementary day's own name. */
  readonly name: string;
  readonly kind: "plant" | "animal" | "tool" | "complementary";
  /** The plant the garden grows: the day's own, or the day before's on an animal or tool day; none on a complementary day. */
  readonly plant: { readonly name: string; readonly form: string; readonly variant: Variant } | null;
  /** The day's animal or tool, when it has a figure. */
  readonly guest: CalendarGuest | null;
}

/** "de la scorsonère" → "la scorsonère", "du raisin" → "le raisin", "des épinards" → "les épinards". */
export function nameFromArticle(article: string): string {
  if (article.startsWith("de la ") || article.startsWith("de l'")) return article.slice(3);
  if (article.startsWith("du ")) return `le ${article.slice(3)}`;
  if (article.startsWith("des ")) return `les ${article.slice(4)}`;
  return article;
}

/** The figure file's name for a day: the bare noun without article or accents, words joined by hyphens. */
export function figureName(article: string): string {
  const bare = nameFromArticle(article).replace(/^(?:la |le |les |l')/u, "");
  // NFD strips accents but leaves the ligatures, which are letters of their own: œ and æ are spelled out.
  return bare.replace(/œ/gu, "oe").replace(/æ/gu, "ae").normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/['\s]+/gu, "-");
}

/** Where a figure's PNG lies, as a URL beside this module; read it with `fs.readFile` in Node or fetch it in a browser. */
export function figureURL(figure: string): URL {
  if (!Object.hasOwn(FIGURES, figure)) throw new Error(`no figure ${figure}`);
  return new URL(`../../figures/${figure}.png`, import.meta.url);
}

const plants = new Map(PLANTS.map(row => [row.day, row]));

/** The day a Gregorian date `YYYY-MM-DD` falls on, with the plant and guest its garden takes. */
export function calendarDay(localDate: string): CalendarDay {
  const date = republicanDate(localDate);
  const year = roman(date.year);
  if (date.complementary) {
    const name = COMPLEMENTARY[date.day - 1]!;
    return { date, dateline: `${name}, an ${year}`, name, kind: "complementary", plant: null, guest: null };
  }
  const index = (date.month - 1) * 30 + date.day - 1;
  const article = DAYS[index]!;
  const kind = date.day % 10 === 0 ? "tool" : date.day % 5 === 0 ? "animal" : "plant";
  const row = plants.get(kind === "plant" ? index : index - 1);
  if (row === undefined) throw new Error(`the plant table has no row for day ${kind === "plant" ? index : index - 1}`);
  let guest: CalendarGuest | null = null;
  if (kind !== "plant") {
    const figure = figureName(article);
    const found = FIGURES[figure];
    if (found) guest = { kind: found.kind, name: nameFromArticle(article), figure, aspect: found.aspect, size: FIGURE_SIZE[found.kind] };
  }
  return {
    date, dateline: `${date.day === 1 ? "1er" : date.day} ${MONTHS[date.month - 1]} an ${year}`, name: nameFromArticle(article), kind,
    plant: { name: nameFromArticle(row.name), form: row.form, variant: row.variant }, guest,
  };
}
