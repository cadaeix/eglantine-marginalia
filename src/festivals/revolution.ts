// The festival of the Revolution, the sixth complementary day, in a sextile year only: the seed. A single
// one, in the middle of the blank, and the loop begins again: towards evening the seed's root comes out of
// its tip and turns down. A plant with no kernel of its own leaves what its bloom becomes, without a root.
import type { FestivalContext, FestivalModule } from "../festival.js";
import { LAYER } from "../form.js";
import type { Garden, GardenItem } from "../garden.js";
import { bezier3, type Pt, RAD, sample } from "../geometry.js";

/** The seed's length from base to tip, in centimetres: a chestnut's, about life size. */
const SIZE = 1.3;

function grow(context: FestivalContext): Garden {
  const { form, rng, width: W, height: H } = context;
  // It lies on its side, its tip a little lower than its base.
  const angle = rng.chance(0.5) ? -rng.range(15, 40) : 180 + rng.range(15, 40);
  const axis: Pt = [Math.cos(angle * RAD), Math.sin(angle * RAD)];
  const at: Pt = [W / 2 - axis[0] * SIZE / 2, H / 2 - axis[1] * SIZE / 2];
  const kernel = form.kernel;
  const items: GardenItem[] = [{
    kind: "motif", order: 0, layer: LAYER.bloom, name: "kernel", at, angle, size: SIZE, seed: Math.floor(rng.u() * 4294967295),
    born: 0, staged: false, seedAt: 2, leafRank: null, draw: kernel ?? ((r, s) => form.terminal.draw(r, s, "seed")),
  }];
  if (kernel) {
    const tip: Pt = [at[0] + axis[0] * SIZE * 0.97, at[1] + axis[1] * SIZE * 0.97];
    const bend = rng.range(0.15, 0.35);
    const points = sample(bezier3(tip, [tip[0] + axis[0] * 0.35, tip[1] + axis[1] * 0.35],
      [tip[0] + axis[0] * (0.5 + bend), tip[1] - 0.45], [tip[0] + axis[0] * (0.45 + bend), tip[1] - 1.05]), 14);
    items.unshift({ kind: "stem", order: 0, layer: LAYER.stem, main: false, points, w0: 0.05, w1: 0.008, born: 0.8, grown: 0.97 });
  }
  return context.compose(items);
}

export const festival: FestivalModule = { id: "revolution", grow };
