// The plant forms and festivals the library knows. They are listed by hand, not discovered, so the registry
// loads the same way in a browser, a bundler and Node.
import type { Festival, FestivalModule } from "./festival.js";
import { festival as genie } from "./festivals/genie.js";
import { festival as opinion } from "./festivals/opinion.js";
import { festival as recompenses } from "./festivals/recompenses.js";
import { festival as revolution } from "./festivals/revolution.js";
import { festival as travail } from "./festivals/travail.js";
import { festival as vertu } from "./festivals/vertu.js";
import { type FormModule, type PlantForm, resolveVariant, type Variant } from "./form.js";
import { form as arbreFruitier } from "./forms/arbre-fruitier.form.js";
import { form as capitule } from "./forms/capitule.form.js";
import { form as conifere } from "./forms/conifere.form.js";
import { form as cryptogame } from "./forms/cryptogame.form.js";
import { form as epiAromatique } from "./forms/epi-aromatique.form.js";
import { form as epiGraminee } from "./forms/epi-graminee.form.js";
import { form as feuillage } from "./forms/feuillage.form.js";
import { form as grimpante } from "./forms/grimpante.form.js";
import { form as hiver } from "./forms/hiver.form.js";
import { form as lisBulbe } from "./forms/lis-bulbe.form.js";
import { form as ombelleCorymbe } from "./forms/ombelle-corymbe.form.js";
import { form as racineTubercule } from "./forms/racine-tubercule.form.js";
import { form as rosaceeCoupe } from "./forms/rosacee-coupe.form.js";

export const FORM_MODULES: ReadonlyMap<string, FormModule> = new Map([
  arbreFruitier, capitule, conifere, cryptogame, epiAromatique, epiGraminee, feuillage, grimpante, hiver, lisBulbe, ombelleCorymbe,
  racineTubercule, rosaceeCoupe,
].map(module => [module.id, module]));

const built = new Map<string, PlantForm>();

/** The plant form for an id and variant; builds are cached, since a form is pure data and functions. */
export function plantForm(id: string, variant: Variant = {}): PlantForm {
  const module = FORM_MODULES.get(id);
  if (!module) throw new Error(`no plant form ${id}`);
  const resolved = resolveVariant(module, variant);
  const key = `${id}:${JSON.stringify(Object.entries(resolved).sort(([a], [b]) => a.localeCompare(b)))}`;
  let form = built.get(key);
  if (!form) { form = module.build(resolved); built.set(key, form); }
  return form;
}

export const FESTIVAL_MODULES: ReadonlyMap<Festival, FestivalModule> = new Map([vertu, genie, travail, opinion, recompenses, revolution].map(module => [module.id, module]));

/** The festival with a known id. */
export function festivalModule(id: string): FestivalModule {
  const module = FESTIVAL_MODULES.get(id as Festival);
  if (!module) throw new RangeError(`no festival ${id}`);
  return module;
}
