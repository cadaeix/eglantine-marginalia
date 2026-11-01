import { describe, expect, it } from "vitest";
import { calendarDay } from "../src/calendar/index.js";
import { COLUMN, growGarden } from "../src/grow.js";

const epoch = Date.UTC(1792, 8, 22);
const days = Array.from({ length: 360 }, (_, offset) => calendarDay(new Date(epoch + offset * 86_400_000).toISOString().slice(0, 10)))
  .filter(day => day.guest !== null);

describe("calendar guests", () => {
  it.each([1, 1793, 20261101])("keeps every guest within the standard column at seed %i", seed => {
    for (const day of days) {
      const source = day.guest!, plant = day.plant!;
      const garden = growGarden({ seed, form: plant.form, variant: plant.variant, guest: source });
      const label = `${source.figure}, seed ${seed}`;
      expect(garden.guest, label).not.toBeNull();
      const guest = garden.guest!;
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

  it("places a guest deterministically from its seed", () => {
    const day = days[0]!, plant = day.plant!;
    const spec = { seed: 1793, form: plant.form, variant: plant.variant, guest: day.guest! };
    expect(growGarden(spec).guest).toEqual(growGarden(spec).guest);
  });
});
