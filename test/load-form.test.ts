import { describe, expect, it } from "vitest";
import { type Garden, growGarden as growFromForm } from "../src/garden.js";
import { growGarden } from "../src/grow.js";
import { loadFestival } from "../src/load-festival.js";
import { loadForm } from "../src/load-form.js";
import { FESTIVAL_MODULES, FORM_MODULES } from "../src/registry.js";
import { renderGarden } from "../src/render.js";

describe("forms loaded one at a time", () => {
  it("loads every registered form, the same form the registry holds", async () => {
    for (const [id, module] of FORM_MODULES) expect(await loadForm(id)).toBe(module);
  });

  it("grows from a loaded form the garden its id grows", async () => {
    const [module] = FORM_MODULES.values();
    const example = module!.examples[0]!;
    const spec = { seed: 1793, variant: example.variant, width: 6, height: 40 };
    const draw = (garden: Garden) => renderGarden(garden, { t: 0.6, fullness: 0 }, { manner: "taille-douce", id: "f", scale: 24 });
    expect(draw(growFromForm({ ...spec, form: await loadForm(module!.id) }))).toBe(draw(growGarden({ ...spec, form: module!.id })));
  });

  it("refuses a form it does not know", async () => {
    await expect(loadForm("rosier-grimpant")).rejects.toThrow("no plant form rosier-grimpant");
    await expect(loadForm("toString")).rejects.toThrow("no plant form toString");
  });
});

describe("festivals loaded one at a time", () => {
  it("loads every registered festival, and grows from it the garden its id grows", async () => {
    const form = await loadForm("arbre-fruitier");
    const spec = { seed: 1793, variant: { fruit: "nut", husk: "burr", nuts: 1 } };
    const draw = (garden: Garden) => renderGarden(garden, { t: 0.9, fullness: 0.8 }, { manner: "lavis", id: "f", scale: 24 });
    for (const [id, module] of FESTIVAL_MODULES) {
      const loaded = await loadFestival(id);
      expect(loaded).toBe(module);
      expect(draw(growFromForm({ ...spec, form, festival: loaded })), id).toBe(draw(growGarden({ ...spec, form: "arbre-fruitier", festival: id })));
    }
  });

  it("refuses a festival it does not know, and a festival's bare id where its module is wanted", async () => {
    await expect(loadFestival("toString")).rejects.toThrow("no festival toString");
    expect(() => growGarden({ seed: 1, form: "capitule", festival: "carnaval" as "vertu" })).toThrow("no festival carnaval");
    const form = await loadForm("capitule");
    expect(() => growFromForm({ seed: 1, form, festival: "vertu" as unknown as never })).toThrow(TypeError);
  });
});
