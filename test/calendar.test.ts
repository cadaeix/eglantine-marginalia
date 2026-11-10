import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { calendarDay, DAYS, FIGURES, figureGuest, figureName, figureURL, HANAMI, localDate, nameFromArticle, PLANTS, republicanDate } from "../src/calendar/index.js";
import { growGarden } from "../src/grow.js";
import { plantForm } from "../src/registry.js";

describe("the Republican calendar", () => {
  it("begins on 22 September 1792 and refuses what is not a date after it", () => {
    expect(republicanDate("1792-09-22")).toEqual({ year: 1, month: 1, day: 1, complementary: false });
    expect(() => republicanDate("1792-09-21")).toThrow(RangeError);
    expect(() => republicanDate("2026-02-29")).toThrow(RangeError);
    expect(() => republicanDate("2026-2-3")).toThrow(RangeError);
  });

  it("keeps the four-year rhythm: years III, VII, XI and every fourth after have six complementary days", () => {
    // Year III ran from 22 September 1794 to 22 September 1795; its sixth complementary day was the last.
    expect(republicanDate("1795-09-22")).toEqual({ year: 3, month: null, day: 6, complementary: true });
    expect(republicanDate("1795-09-23")).toEqual({ year: 4, month: 1, day: 1, complementary: false });
    expect(republicanDate("1793-09-21")).toEqual({ year: 1, month: null, day: 5, complementary: true });
    expect(republicanDate("1793-09-22")).toEqual({ year: 2, month: 1, day: 1, complementary: false });
    expect(republicanDate("2026-10-31")).toEqual({ year: 235, month: 2, day: 8, complementary: false });
  });

  it("reads the date in the time zone asked for", () => {
    const instant = Date.UTC(2026, 9, 31, 14, 0);
    expect(localDate(instant, "Australia/Melbourne")).toBe("2026-11-01");
    expect(localDate(instant, "Europe/Paris")).toBe("2026-10-31");
  });
});

describe("a plant for every day", () => {
  it("gives a plant day its own plant, and an animal or tool day the day before's plant with its figure", () => {
    const plant = calendarDay("2026-10-31");
    expect(plant).toMatchObject({ dateline: "8 brumaire an CCXXXV", name: "la scorsonère", kind: "plant", guest: null });
    expect(plant.plant?.name).toBe("la scorsonère");
    const animal = calendarDay("2026-10-28");
    expect(animal).toMatchObject({ dateline: "5 brumaire an CCXXXV", name: "l'oie", kind: "animal" });
    expect(animal.plant?.name).toBe(nameFromArticle(DAYS[33]!));
    expect(animal.guest).toMatchObject({ kind: "visitor", stance: "shoot", name: "l'oie", figure: "oie" });
    const tool = calendarDay("2026-11-02");
    expect(tool).toMatchObject({ dateline: "10 brumaire an CCXXXV", kind: "tool" });
    expect(tool.plant?.name).toBe(nameFromArticle(DAYS[38]!));
    expect(tool.guest).toMatchObject({ kind: "rest", figure: "charrue" });
    // The four-year rule has drifted two days from the Gregorian calendar since 1792.
    expect(calendarDay("2026-09-24").dateline).toBe("1er vendémiaire an CCXXXV");
  });

  it("gives each complementary day its festival and the year's last plant, five days in a common year and six in a sextile one", () => {
    const marron = { name: "le marron", form: "arbre-fruitier", variant: PLANTS.find(row => row.name === "du marron")!.variant };
    expect(calendarDay("2026-09-19")).toMatchObject({ dateline: "jour de la vertu, an CCXXXIV", kind: "complementary", plant: marron, guest: null, festival: "vertu" });
    expect(calendarDay("2026-09-23")).toMatchObject({ name: "jour des récompenses", festival: "recompenses" });
    expect(calendarDay("2026-09-24").festival).toBeNull();
    const sextile = ["2027-09-19", "2027-09-20", "2027-09-21", "2027-09-22", "2027-09-23", "2027-09-24"].map(date => calendarDay(date));
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
