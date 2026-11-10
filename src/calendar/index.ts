// A plant for every day: the French Republican calendar's day names, read as a garden. Each day of a
// month is named for a plant, except the quintidi, named for an animal, and the décadi, named for a tool.
// On those days the garden grows the day before's plant, and the animal visits it or the tool lies at rest
// at its foot. The complementary days at the year's end are named for festivals, not plants: on each the
// garden grows the year's last plant, and the day's festival does something to it.
import { type Festival, FESTIVALS } from "../festival.js";
import type { Variant } from "../form.js";
import type { GuestStance } from "../garden.js";
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
  /** Where an animal stands: on a shoot of its own, among the stems, or on the ground. A tool has none. */
  readonly stance?: GuestStance;
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
  /** The plant the garden grows: the day's own, the day before's on an animal or tool day, or the year's last on a complementary day. */
  readonly plant: { readonly name: string; readonly form: string; readonly variant: Variant };
  /** The day's animal or tool, when it has a figure. */
  readonly guest: CalendarGuest | null;
  /** A complementary day's festival, done to the year's last plant; it can be passed to `growGarden` as it is. */
  readonly festival: Festival | null;
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
/** Each figure's day, as its name is written in the day names: "du lapin" for lapin. */
const figureDays = new Map<string, string>();
for (const article of DAYS) if (!figureDays.has(figureName(article))) figureDays.set(figureName(article), article);

/**
 * A figure as a garden's guest, for any plant: `figureGuest("lapin")` brings the rabbit of 15 nivôse to whatever the
 * garden grows. It is the guest the figure's own day brings.
 */
export function figureGuest(figure: string): CalendarGuest {
  const article = figureDays.get(figure);
  if (!Object.hasOwn(FIGURES, figure) || article === undefined) throw new Error(`no figure ${figure}`);
  const found = FIGURES[figure]!;
  return { kind: found.kind, ...(found.stance ? { stance: found.stance } : {}), name: nameFromArticle(article), figure, aspect: found.aspect, size: FIGURE_SIZE[found.kind] };
}

/** The calendar's cherry, which 19 messidor grows in fruit. */
const cherry = PLANTS.find(row => row.name === "de la cerise")!;
/**
 * A day outside the calendar, for those who love rabbits: hanami, the viewing of the cherry blossom. Le lapin comes
 * to see the calendar's cherry in flower, and stays to watch its petals fall. It has a plant and a guest as a
 * calendar day has, so it grows as one does.
 */
export const HANAMI: Pick<CalendarDay, "name" | "plant" | "festival"> & { readonly guest: CalendarGuest } = {
  name: "hanami",
  plant: { name: "le cerisier en fleur", form: cherry.form, variant: { ...cherry.variant, blossom: true } },
  guest: figureGuest("lapin"),
  festival: null,
};

/** The year's last plant, which the last day of fructidor grows: le marron. The complementary days hold their festivals with it. */
const yearsPlant = PLANTS.reduce((last, row) => row.day > last.day ? row : last);

/** The day a Gregorian date `YYYY-MM-DD` falls on, with the plant and guest its garden takes, or a complementary day's festival. */
export function calendarDay(localDate: string): CalendarDay {
  const date = republicanDate(localDate);
  const year = roman(date.year);
  if (date.complementary) {
    const name = COMPLEMENTARY[date.day - 1]!;
    return {
      date, dateline: `${name}, an ${year}`, name, kind: "complementary",
      plant: { name: nameFromArticle(yearsPlant.name), form: yearsPlant.form, variant: yearsPlant.variant }, guest: null, festival: FESTIVALS[date.day - 1]!,
    };
  }
  const index = (date.month - 1) * 30 + date.day - 1;
  const article = DAYS[index]!;
  const kind = date.day % 10 === 0 ? "tool" : date.day % 5 === 0 ? "animal" : "plant";
  const row = plants.get(kind === "plant" ? index : index - 1);
  if (row === undefined) throw new Error(`the plant table has no row for day ${kind === "plant" ? index : index - 1}`);
  let guest: CalendarGuest | null = null;
  if (kind !== "plant") {
    const figure = figureName(article);
    if (Object.hasOwn(FIGURES, figure)) guest = figureGuest(figure);
  }
  return {
    date, dateline: `${date.day === 1 ? "1er" : date.day} ${MONTHS[date.month - 1]} an ${year}`, name: nameFromArticle(article), kind,
    plant: { name: nameFromArticle(row.name), form: row.form, variant: row.variant }, guest, festival: null,
  };
}
