import { describe, expect, it } from "vitest";
import { type CalendarDay, calendarDay } from "../src/calendar/index.js";
import { COLUMN, type Garden, type GuestPlace, growGarden, type StemItem } from "../src/grow.js";

const epoch = Date.UTC(1792, 8, 22);
const days = Array.from({ length: 360 }, (_, offset) => calendarDay(new Date(epoch + offset * 86_400_000).toISOString().slice(0, 10)))
  .filter(day => day.guest !== null);
const SEEDS = [1, 1793, 20261101];

/** Each day's garden, grown once for each seed and column height and shared between the tests. */
const grown = new Map<string, Garden>();
function gardenOf(day: CalendarDay, seed: number, height: number = COLUMN.height): Garden {
  const key = `${day.dateline} ${seed} ${height}`;
  let garden = grown.get(key);
  if (!garden) {
    garden = growGarden({ seed, form: day.plant.form, variant: day.plant.variant, guest: day.guest!, height });
    grown.set(key, garden);
  }
  return garden;
}

/** The shoot under a guest's feet: a stem other than a main one that runs beneath the figure. */
function shootUnder(garden: Garden, guest: GuestPlace): StemItem | undefined {
  const feet = guest.at[1] - guest.height / 2;
  return garden.items.find((item): item is StemItem => item.kind === "stem" && !item.main
    && item.points.some(([x, y]) => Math.abs(y - feet) < 0.12 && Math.abs(x - guest.at[0]) < guest.width / 2));
}

describe("calendar guests", () => {
  it.each(SEEDS)("keeps every guest within the standard column, and brings it there once, at seed %i", seed => {
    for (const day of days) {
      const source = day.guest!;
      const garden = gardenOf(day, seed);
      const label = `${source.figure}, seed ${seed}`;
      expect(garden.guests, label).toHaveLength(1);
      const guest = garden.guests[0]!;
      expect(guest.width / guest.height, label).toBeCloseTo(source.aspect, 12);
      const angle = guest.angle * Math.PI / 180;
      const halfSpan = (guest.width * Math.abs(Math.cos(angle)) + guest.height * Math.abs(Math.sin(angle))) / 2;
      expect(guest.at[0] - halfSpan, label).toBeGreaterThanOrEqual(0.15 - 1e-10);
      expect(guest.at[0] + halfSpan, label).toBeLessThanOrEqual(COLUMN.width - 0.15 + 1e-10);
      const wantedWidth = source.kind === "visitor" ? source.size * source.aspect : source.size;
      const wantedHeight = source.kind === "visitor" ? source.size : source.size / source.aspect;
      expect(guest.width, label).toBeLessThanOrEqual(wantedWidth);
      expect(guest.height, label).toBeLessThanOrEqual(wantedHeight);
      if (Math.hypot(wantedWidth, wantedHeight) <= COLUMN.width - 0.3) {
        expect(guest.width, label).toBe(wantedWidth);
        expect(guest.height, label).toBe(wantedHeight);
      }
    }
  }, 120_000);

  it.each(SEEDS)("stands every animal where its figure asks: on a shoot grown before it arrives, among the stems, or on the ground, at seed %i", seed => {
    for (const day of days.filter(candidate => candidate.guest!.kind === "visitor")) {
      const garden = gardenOf(day, seed);
      const guest = garden.guests[0]!;
      const label = `${day.guest!.figure}, seed ${seed}`;
      expect(guest.stance, label).toBe(day.guest!.stance);
      if (guest.stance === "shoot") {
        const shoot = shootUnder(garden, guest);
        expect(shoot, label).toBeDefined();
        expect(shoot?.grown, label).toBeLessThanOrEqual(guest.born);
      }
      if (guest.stance === "ground") {
        const stemsRise = Math.min(...garden.mains.map(points => points[0]![1]));
        expect(guest.at[1] - guest.height / 2, label).toBeLessThan(stemsRise);
      }
    }
  }, 120_000);

  it("comes twice in a 30 cm column, apart and every later copy on a shoot of its own, but once on the ground or at rest", () => {
    for (const day of days) {
      const source = day.guest!;
      const garden = gardenOf(day, 1793, 30);
      const label = source.figure;
      if (source.kind === "rest" || source.stance === "ground") expect(garden.guests, label).toHaveLength(1);
      else if (source.stance === "stems") expect(garden.guests, label).toHaveLength(2);
      else {
        expect(garden.guests.length, label).toBeGreaterThanOrEqual(1);
        expect(garden.guests.length, label).toBeLessThanOrEqual(2);
        for (const later of garden.guests.slice(1)) {
          expect(later.stance, label).toBe("shoot");
          expect(shootUnder(garden, later), label).toBeDefined();
        }
      }
      for (const [index, guest] of garden.guests.entries()) {
        for (const other of garden.guests.slice(index + 1)) {
          expect(Math.abs(guest.at[1] - other.at[1]), label).toBeGreaterThanOrEqual(guest.height + 1 - 1e-10);
        }
      }
    }
  }, 120_000);

  it("places a guest deterministically from its seed", () => {
    const day = days[0]!, plant = day.plant;
    const spec = { seed: 1793, form: plant.form, variant: plant.variant, guest: day.guest!, height: 30 };
    expect(growGarden(spec).guests).toEqual(growGarden(spec).guests);
  });
});
