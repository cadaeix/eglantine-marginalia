// Growing a garden from a registered plant form's id as well as a form passed in. The growth itself is in
// garden.ts, which loads no forms.
import { type Garden, growForm, growGarden as growFromForm, type GrowSpec } from "./garden.js";
import { plantForm } from "./registry.js";

export { COLUMN, foliageShown, type Garden, type GardenItem, type GrowSpec, type Guest, type GuestPlace, type MotifItem, type Page, stageAt, stemShown, type StemItem } from "./garden.js";

/** Grows a garden from a registered plant form's id (see registry.ts) or a form passed in. */
export function growGarden(spec: GrowSpec): Garden {
  return typeof spec.form === "string" ? growForm(plantForm(spec.form, spec.variant), spec.form, spec) : growFromForm({ ...spec, form: spec.form });
}
