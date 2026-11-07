// The festival of Virtue: the stem alone, without flower or leaf. The plant's garden keeps its stems, main
// and branched, and whatever it stands on; where a stem's bloom was, the husk its seed has left hangs
// empty, if the plant has one, as the chestnut's burr does. The time of day brings the stems as it always
// does; fullness brings nothing, since nothing here is foliage.
import type { FestivalContext, FestivalModule } from "../festival.js";
import type { Garden, GardenItem } from "../garden.js";

function grow(context: FestivalContext): Garden {
  const garden = context.grow();
  const husk = context.form.husk;
  const items: GardenItem[] = [];
  for (const item of garden.items) {
    if (item.kind === "stem") items.push(item);
    else if (husk && item.name === "terminal") items.push({ ...item, name: "husk", staged: false, leafRank: null, draw: husk });
  }
  return { ...garden, items };
}

export const festival: FestivalModule = { id: "vertu", grow };
