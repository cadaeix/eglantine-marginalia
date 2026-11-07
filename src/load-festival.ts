// The festivals, loaded one at a time. Each loads as its own import, so a bundler splits it into its own
// chunk and a page fetches only the festival it holds. They are listed by hand, as in registry.ts.
import type { Festival, FestivalModule } from "./festival.js";

type Loader = () => Promise<{ festival: FestivalModule }>;

const LOADERS: Readonly<Record<Festival, Loader>> = {
  vertu: () => import("./festivals/vertu.js"),
  genie: () => import("./festivals/genie.js"),
  travail: () => import("./festivals/travail.js"),
  opinion: () => import("./festivals/opinion.js"),
  recompenses: () => import("./festivals/recompenses.js"),
  revolution: () => import("./festivals/revolution.js"),
};

/** The festival with a known id, loaded on its own. */
export async function loadFestival(id: string): Promise<FestivalModule> {
  if (!Object.hasOwn(LOADERS, id)) throw new RangeError(`no festival ${id}`);
  return (await LOADERS[id as Festival]()).festival;
}
