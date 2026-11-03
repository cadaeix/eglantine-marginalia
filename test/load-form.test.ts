import { describe, expect, it } from "vitest";
import { type Garden, growGarden as growFromForm } from "../src/garden.js";
import { growGarden } from "../src/grow.js";
import { loadForm } from "../src/load-form.js";
import { FORM_MODULES } from "../src/registry.js";
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
