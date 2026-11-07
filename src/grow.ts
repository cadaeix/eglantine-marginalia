// Growing a garden from a registered plant form's id as well as a form passed in, and a festival's id as well
// as its module. The growth itself is in garden.ts, which loads no forms and no festivals.
import { resolveVariant } from "./form.js";
import { type Garden, growForm, type GrowSpec } from "./garden.js";
import { festivalModule, plantForm } from "./registry.js";

export { COLUMN, foliageShown, type Garden, type GardenItem, type GrowSpec, type Guest, type GuestPlace, type MotifItem, type Page, stageAt, stemShown, type StemItem } from "./garden.js";

/** Grows a garden from a registered plant form's id (see registry.ts) or a form passed in, with any festival by its id or its module. */
export function growGarden(spec: GrowSpec): Garden {
  const festival = typeof spec.festival === "string" ? { festival: festivalModule(spec.festival) } : {};
  const resolved: GrowSpec = { ...spec, ...festival };
  if (typeof spec.form === "string") return growForm(plantForm(spec.form, spec.variant), spec.form, resolved);
  return growForm(spec.form.build(resolveVariant(spec.form, spec.variant)), spec.form.id, resolved);
}
