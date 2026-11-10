import { describe, expect, it } from "vitest";
import { calendarDay, figureGuest, HANAMI } from "../src/calendar/index.js";
import { createGarden, defaultState, type Geometry, type PlaygroundState, randomDay, readState, resolveSelection, stateHash, usageCode } from "../gallery/garden-state.js";
import { type Garden, ORNAMENTS } from "../src/garden.js";
import { growGarden } from "../src/grow.js";

const fallback = defaultState({ date: "2026-11-03" });

/** The garden the website code grows, run with the library's main entry, the day it names and the guests it asks for. */
function grownByCode(code: string, date: string): Garden {
  const call = /const garden = (growGarden\(\{[\s\S]*?\n\}\));/u.exec(code)![1]!;
  return new Function("growGarden", "day", "figureGuest", `return ${call};`)(growGarden, calendarDay(date), figureGuest) as Garden;
}

describe("the playground's settings", () => {
  it("keeps every setting in a shared link", () => {
    const state: PlaygroundState = {
      source: "plants", plant: "juniper", date: "1793-10-24", seed: 4_000_000_000, manner: "taille-douce", palette: "madder",
      reading: "dark", t: 0.33, fullness: 0.91, mode: "hanging", side: "left", visitors: "floating",
    };
    expect(readState(stateHash(state), fallback)).toEqual(state);
  });

  it("keeps the band modes in a shared link, and falls back from a mode it does not know", () => {
    for (const mode of ["bandeau", "cul-de-lampe"] as const) {
      const state: PlaygroundState = { ...fallback, mode };
      expect(readState(stateHash(state), fallback)).toEqual(state);
    }
    expect(readState("#mode=cul-de-four", { ...fallback, mode: "margin" }).mode).toBe("margin");
  });

  it("falls back setting by setting on a link it cannot read, including links from before the page modes", () => {
    const read = readState("#mode=sideways&t=2&palette=nope&date=1700-01-01&seed=-4&side=right&margin=32&plant=rose", fallback);
    expect(read).toEqual({ ...fallback, side: "right", plant: "rose" });
  });

  it("names each calendar day in English beside its French name", () => {
    expect(resolveSelection({ ...fallback, date: "2026-09-24" })).toMatchObject({ title: "Le raisin", gloss: "grape" });
    expect(resolveSelection({ ...fallback, date: "2026-11-03" })).toMatchObject({ title: "Le salsifis", gloss: "salsify" });
    expect(resolveSelection({ ...fallback, date: "2026-09-18" })).toMatchObject({ title: "Le panier", gloss: "pack basket" });
  });

  it("grows the year's last plant under a complementary day's festival, and its website code asks for the festival too", async () => {
    const state = { ...fallback, date: "2027-09-22", mode: "margin" as const };
    const selection = resolveSelection(state);
    expect(selection).toMatchObject({ title: "Jour de l'opinion", gloss: "the day of convictions", form: "arbre-fruitier", festival: "opinion", guest: null });
    const geometry = { column: 6, height: 22, text: 10, below: 6, measure: 9 };
    const { garden } = await createGarden(state, geometry);
    const asked = growGarden({ seed: state.seed, form: selection.form, variant: selection.variant, width: 6, height: 22, festival: "opinion" });
    expect(JSON.stringify(garden.items)).toBe(JSON.stringify(asked.items));
    expect(usageCode(state, geometry)).toContain("...(day.festival ? { festival: day.festival } : {}),");
  });

  it("lets the day's animal float among the stems, as every animal once did, and its website code asks for that too", async () => {
    // Le cochon stands on a shoot of his own unless the visitors float.
    const state = { ...fallback, date: "2026-11-27", mode: "margin" as const };
    const geometry = { column: 6, height: 30, text: 10, below: 6, measure: 9 };
    expect((await createGarden(state, geometry)).garden.guests.every(guest => guest.stance === "shoot")).toBe(true);
    const floating = { ...state, visitors: "floating" as const };
    const { garden } = await createGarden(floating, geometry);
    expect(garden.guests.length).toBeGreaterThan(0);
    expect(garden.guests.every(guest => guest.stance === "stems")).toBe(true);
    const day = calendarDay(floating.date);
    const asked = growGarden({ seed: floating.seed, form: day.plant.form, variant: day.plant.variant, width: 6, height: 30, guest: { ...day.guest!, stance: "stems" } });
    expect(garden.guests).toEqual(asked.guests);
    expect(usageCode(floating, geometry)).toContain('...(day.guest ? { guest: { ...day.guest, stance: "stems" } } : {}),');
    expect(usageCode(state, geometry)).toContain("...(day.guest ? { guest: day.guest } : {}),");
  });

  it("brings le lapin to the cherry in blossom from a link to the hidden hanami, and its website code asks for him too", async () => {
    const state = readState("#source=plants&plant=hanami&mode=margin", fallback);
    expect([state.source, state.plant]).toEqual(["plants", "hanami"]);
    const geometry = { column: 6, height: 25, text: 10, below: 6, measure: 9 };
    const { garden } = await createGarden(state, geometry);
    expect(garden.guests).toHaveLength(1);
    expect(JSON.stringify(grownByCode(usageCode(state, geometry), state.date))).toBe(JSON.stringify(garden));
    const asked = growGarden({ seed: state.seed, form: HANAMI.plant.form, variant: HANAMI.plant.variant, width: 6, height: 25, guest: HANAMI.guest });
    expect(garden.guests).toEqual(asked.guests);
  });

  it("grows a headpiece as wide as the text and keeps the day's animal, and its website code grows the same band", async () => {
    // Le cochon visits on a shoot of his own.
    const state = { ...fallback, date: "2026-11-27", mode: "bandeau" as const };
    const geometry: Geometry = { column: 6, height: 25, text: 18.5, below: 0, measure: 17.5 };
    const { garden } = await createGarden(state, geometry);
    expect([garden.width, garden.height]).toEqual([17.5, ORNAMENTS.bandeau.height]);
    expect(garden.guests.length).toBeGreaterThan(0);
    const asked = grownByCode(usageCode(state, geometry), state.date);
    expect(JSON.stringify(garden.items)).toBe(JSON.stringify(asked.items));
    expect(garden.guests).toEqual(asked.guests);
  });

  it("grows a tailpiece its own size unless the text is narrower, and its website code grows the same band", async () => {
    const state = { ...fallback, source: "plants" as const, plant: "rose", mode: "cul-de-lampe" as const };
    const room = ORNAMENTS["cul-de-lampe"];
    const wide = await createGarden(state, { column: 6, height: 25, text: 30, below: 0, measure: room.width + 10 });
    expect([wide.garden.width, wide.garden.height]).toEqual([room.width, room.height]);
    const geometry: Geometry = { column: 6, height: 25, text: 9, below: 0, measure: room.width - 2 };
    const { garden } = await createGarden(state, geometry);
    expect([garden.width, garden.height]).toEqual([room.width - 2, room.height]);
    expect(JSON.stringify(garden.items)).toBe(JSON.stringify(grownByCode(usageCode(state, geometry), state.date).items));
  });

  it("picks a random plant from a plant's day, and a random visitor from a day whose guest has an engraving", () => {
    const picked = new Set<string>();
    for (let k = 0; k < 60; k += 1) {
      const plant = randomDay("plant", "2026-11-03", () => k / 60, "2026-11-03");
      const visitor = randomDay("visitor", "2026-11-03", () => k / 60);
      expect(calendarDay(plant).kind).toBe("plant");
      expect(calendarDay(visitor).guest).not.toBeNull();
      picked.add(plant);
    }
    expect(picked.has("2026-11-03")).toBe(false);
  });
});
