import { describe, expect, it } from "vitest";
import { calendarDay } from "../src/calendar/index.js";
import { createGarden, defaultState, type PlaygroundState, randomDay, readState, resolveSelection, stateHash, usageCode } from "../gallery/garden-state.js";
import { growGarden } from "../src/grow.js";

const fallback = defaultState({ date: "2026-11-03" });

describe("the playground's settings", () => {
  it("keeps every setting in a shared link", () => {
    const state: PlaygroundState = {
      source: "plants", plant: "juniper", date: "1793-10-24", seed: 4_000_000_000, manner: "taille-douce", palette: "madder",
      reading: "dark", t: 0.33, fullness: 0.91, mode: "hanging", side: "left",
    };
    expect(readState(stateHash(state), fallback)).toEqual(state);
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

  it("grows the year's last plant under a complementary day's festival, and its website code asks for the festival too", () => {
    const state = { ...fallback, date: "2027-09-22", mode: "margin" as const };
    const selection = resolveSelection(state);
    expect(selection).toMatchObject({ title: "Jour de l'opinion", gloss: "the day of convictions", form: "arbre-fruitier", festival: "opinion", guest: null });
    const geometry = { column: 6, height: 22, text: 10, below: 6 };
    const { garden } = createGarden(state, geometry);
    const asked = growGarden({ seed: state.seed, form: selection.form, variant: selection.variant, width: 6, height: 22, festival: "opinion" });
    expect(JSON.stringify(garden.items)).toBe(JSON.stringify(asked.items));
    expect(usageCode(state, geometry)).toContain("...(day.festival ? { festival: day.festival } : {}),");
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
