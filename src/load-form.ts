// The plant forms, loaded one at a time. Each loads as its own import, so a bundler splits it into its own
// chunk and a page fetches only the forms it draws. They are listed by hand, as in registry.ts.
import type { FormModule } from "./form.js";

type Loader = () => Promise<{ form: FormModule }>;

const LOADERS: Readonly<Record<string, Loader>> = {
  "arbre-fruitier": () => import("./forms/arbre-fruitier.form.js"),
  capitule: () => import("./forms/capitule.form.js"),
  conifere: () => import("./forms/conifere.form.js"),
  cryptogame: () => import("./forms/cryptogame.form.js"),
  "epi-aromatique": () => import("./forms/epi-aromatique.form.js"),
  "epi-graminee": () => import("./forms/epi-graminee.form.js"),
  feuillage: () => import("./forms/feuillage.form.js"),
  grimpante: () => import("./forms/grimpante.form.js"),
  hiver: () => import("./forms/hiver.form.js"),
  "lis-bulbe": () => import("./forms/lis-bulbe.form.js"),
  "ombelle-corymbe": () => import("./forms/ombelle-corymbe.form.js"),
  "racine-tubercule": () => import("./forms/racine-tubercule.form.js"),
  "rosacee-coupe": () => import("./forms/rosacee-coupe.form.js"),
};

/** The plant form with a registered id, loaded on its own. */
export async function loadForm(id: string): Promise<FormModule> {
  if (!Object.hasOwn(LOADERS, id)) throw new Error(`no plant form ${id}`);
  return (await LOADERS[id]!()).form;
}
