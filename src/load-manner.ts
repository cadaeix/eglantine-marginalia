// The manners, loaded one at a time. The period manners are painted by the core and need no loading; the three
// screen manners load together as their own import, so a bundler splits them into a chunk of their own and a page
// fetches them only when it draws one. They are listed by hand, as in paint.ts.
import { type Manner, type MannerModule, MANNERS, periodManner, type ScreenManner } from "./paint.js";

type Loader = () => Promise<MannerModule>;

const screen = (id: ScreenManner): Loader => async () => (await import("./screen.js")).SCREEN_MANNERS[id];

const LOADERS: Readonly<Record<Manner, Loader>> = {
  "taille-douce": async () => periodManner("taille-douce"),
  lavis: async () => periodManner("lavis"),
  pointille: async () => periodManner("pointille"),
  crayon: async () => periodManner("crayon"),
  bois: async () => periodManner("bois"),
  mosaique: screen("mosaique"),
  carreaux: screen("carreaux"),
  nekyia: screen("nekyia"),
};

/** The manner with a known id, ready to paint; a screen manner is fetched on its own the first time. */
export async function loadManner(id: string): Promise<MannerModule> {
  if (!Object.hasOwn(LOADERS, id)) throw new RangeError(`A manner is one of ${MANNERS.join(", ")}, not ${id}`);
  return LOADERS[id as Manner]();
}
