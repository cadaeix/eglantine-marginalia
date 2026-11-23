import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { calendarDay, DAYS, FIGURES, figureGuest, figureName, figureURL, HANAMI, localDate, nameFromArticle, PLANTS, republicanDate } from "../src/calendar/index.js";
import { growGarden } from "../src/grow.js";
import { plantForm } from "../src/registry.js";

describe("the Republican calendar", () => {
  it("begins on 22 September 1792 and refuses what is not a date after it, or lies past the reckoned equinoxes", () => {
    expect(republicanDate("1792-09-22")).toEqual({ year: 1, month: 1, day: 1, complementary: false });
    expect(() => republicanDate("1792-09-21")).toThrow(RangeError);
    expect(() => republicanDate("2026-02-29")).toThrow(RangeError);
    expect(() => republicanDate("2026-2-3")).toThrow(RangeError);
    expect(republicanDate("3000-12-31").complementary).toBe(false);
    expect(() => republicanDate("3001-01-01")).toThrow(RangeError);
  });

  it("opens years I to XIV on the new years the Republic kept, with years III, VII and XI sextile", () => {
    const newYears = ["1792-09-22", "1793-09-22", "1794-09-22", "1795-09-23", "1796-09-22", "1797-09-22", "1798-09-22",
      "1799-09-23", "1800-09-23", "1801-09-23", "1802-09-23", "1803-09-24", "1804-09-23", "1805-09-23"];
    const sextile: number[] = [];
    newYears.forEach((date, index) => {
      expect(republicanDate(date), date).toEqual({ year: index + 1, month: 1, day: 1, complementary: false });
      if (index === 0) return;
      const eve = new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
      const last = republicanDate(eve);
      expect(last, eve).toMatchObject({ year: index, complementary: true });
      if (last.day === 6) sextile.push(last.year);
      else expect(last.day, eve).toBe(5);
    });
    expect(sextile).toEqual([3, 7, 11]);
    // Dated days of the Republic: the decree itself, Robespierre's fall and the last winter of the calendar.
    expect(republicanDate("1793-11-24")).toEqual({ year: 2, month: 3, day: 4, complementary: false });
    expect(republicanDate("1794-07-27")).toEqual({ year: 2, month: 11, day: 9, complementary: false });
    expect(republicanDate("1805-12-31")).toEqual({ year: 14, month: 4, day: 10, complementary: false });
  });

  it("keeps to the true equinox at Paris in years the Republic never reached", () => {
    expect(republicanDate("2026-09-22")).toEqual({ year: 234, month: null, day: 6, complementary: true });
    expect(republicanDate("2026-09-23")).toEqual({ year: 235, month: 1, day: 1, complementary: false });
    expect(republicanDate("2026-11-22")).toEqual({ year: 235, month: 3, day: 1, complementary: false });
    expect(republicanDate("2027-09-22")).toEqual({ year: 235, month: null, day: 5, complementary: true });
    expect(republicanDate("2027-09-23")).toEqual({ year: 236, month: 1, day: 1, complementary: false });
  });

  it("reads the date in the time zone asked for", () => {
    const instant = Date.UTC(2026, 9, 31, 14, 0);
    expect(localDate(instant, "Australia/Melbourne")).toBe("2026-11-01");
    expect(localDate(instant, "Europe/Paris")).toBe("2026-10-31");
  });
});

describe("a plant for every day", () => {
  it("gives a plant day its own plant, and an animal or tool day the day before's plant with its figure", () => {
    const plant = calendarDay("2026-10-30");
    expect(plant).toMatchObject({ dateline: "8 brumaire an CCXXXV", name: "la scorsonère", kind: "plant", guest: null });
    expect(plant.plant?.name).toBe("la scorsonère");
    const animal = calendarDay("2026-10-27");
    expect(animal).toMatchObject({ dateline: "5 brumaire an CCXXXV", name: "l'oie", kind: "animal" });
    expect(animal.plant?.name).toBe(nameFromArticle(DAYS[33]!));
    expect(animal.guest).toMatchObject({ kind: "visitor", stance: "shoot", name: "l'oie", figure: "oie" });
    const tool = calendarDay("2026-11-01");
    expect(tool).toMatchObject({ dateline: "10 brumaire an CCXXXV", kind: "tool" });
    expect(tool.plant?.name).toBe(nameFromArticle(DAYS[38]!));
    expect(tool.guest).toMatchObject({ kind: "rest", figure: "charrue" });
    expect(calendarDay("2026-11-22")).toMatchObject({ dateline: "1er frimaire an CCXXXV", name: "la raiponce" });
  });

  it("gives each complementary day its festival and the year's last plant, five days in a common year and six in a sextile one", () => {
    const marron = { name: "le marron", form: "arbre-fruitier", variant: PLANTS.find(row => row.name === "du marron")!.variant };
    expect(calendarDay("2027-09-18")).toMatchObject({ dateline: "jour de la vertu, an CCXXXV", kind: "complementary", plant: marron, guest: null, festival: "vertu" });
    expect(calendarDay("2027-09-22")).toMatchObject({ name: "jour des récompenses", festival: "recompenses" });
    expect(calendarDay("2027-09-23").festival).toBeNull();
    const sextile = ["2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22"].map(date => calendarDay(date));
    expect(sextile.map(day => day.festival)).toEqual(["vertu", "genie", "travail", "opinion", "recompenses", "revolution"]);
    expect(sextile.every(day => day.plant.name === "le marron" && day.guest === null)).toBe(true);
  });

  it("names a form and variant the library knows for every plant day of the year", () => {
    const rows = new Map(PLANTS.map(row => [row.day, row]));
    expect(PLANTS.length).toBe(288);
    for (let day = 0; day < 360; day += 1) {
      const row = rows.get(day);
      if ((day % 30 + 1) % 5 === 0) { expect(row, `${DAYS[day]} is an animal or tool day`).toBeUndefined(); continue; }
      expect(row?.name, `day ${day}`).toBe(DAYS[day]);
      expect(() => plantForm(row!.form, row!.variant), `${row!.name}`).not.toThrow();
    }
  });

  it("has a figure for every animal and tool day, and ships each one", () => {
    const missing = DAYS.filter((_, day) => (day % 30 + 1) % 5 === 0).map(figureName).filter(name => FIGURES[name] === undefined);
    expect(missing).toEqual([]);
    for (const name of Object.keys(FIGURES)) expect(existsSync(fileURLToPath(figureURL(name))), name).toBe(true);
    for (const name of ["licorne", "toString", "../oie"]) expect(() => figureURL(name), name).toThrow();
  });

  it("spells figure names without articles, accents or ligatures", () => {
    expect(figureName("de l'écrevisse")).toBe("ecrevisse");
    expect(figureName("du bœuf")).toBe("boeuf");
    expect(figureName("du ver à soie")).toBe("ver-a-soie");
    expect(nameFromArticle("des épinards")).toBe("les épinards");
  });
});

describe("guests away from their days", () => {
  it("brings any figure to any plant as the guest its own day brings, and refuses a figure it does not know", () => {
    const days = Array.from({ length: 360 }, (_, offset) => calendarDay(new Date(Date.UTC(2026, 8, 22 + offset)).toISOString().slice(0, 10)));
    for (const day of days.filter(candidate => candidate.guest)) expect(figureGuest(day.guest!.figure)).toEqual(day.guest);
    expect(() => figureGuest("licorne")).toThrow();
  });

  it("grows hanami: the calendar's cherry in blossom, visited by le lapin, shedding its petals", () => {
    const garden = growGarden({ seed: 1793, form: HANAMI.plant.form, variant: HANAMI.plant.variant, guest: HANAMI.guest });
    expect(HANAMI.guest.name).toBe("le lapin");
    expect(garden.guests).toHaveLength(1);
    expect(garden.items.some(item => item.kind === "motif" && item.name === "petal")).toBe(true);
  });
});
