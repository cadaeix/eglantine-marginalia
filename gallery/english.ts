// Source: the day-name tables in English Wikipedia, "French Republican calendar".
// https://en.wikipedia.org/wiki/French_Republican_calendar

/** English names for the calendar's 360 days, in the order of DAYS in src/calendar/names.ts. */
export const ENGLISH_DAYS: readonly string[] = [
  // vendémiaire
  "grape", "saffron", "chestnut", "autumn crocus", "horse",
  "impatiens", "carrot", "amaranth", "parsnip", "vat",
  "potato", "strawflower", "winter squash", "mignonette", "donkey",
  "four o'clock flower", "pumpkin", "buckwheat", "sunflower", "winepress",
  "hemp", "peach", "turnip", "amaryllis", "ox",
  "eggplant", "chili pepper", "tomato", "barley", "barrel",
  // brumaire
  "apple", "celery", "pear", "beetroot", "goose",
  "heliotrope", "fig", "black salsify", "chequer tree", "plough",
  "salsify", "water caltrop", "Jerusalem artichoke", "endive", "turkey",
  "skirret", "watercress", "leadwort", "pomegranate", "harrow",
  "baccharis", "azarole", "madder", "orange", "pheasant",
  "pistachio", "tuberous pea", "quince", "service tree", "roller",
  // frimaire
  "rampion", "cattle turnip", "chicory", "medlar", "pig",
  "lamb's lettuce", "cauliflower", "honey", "juniper", "pickaxe",
  "wax", "horseradish", "cedar", "fir", "roe deer",
  "gorse", "cypress", "ivy", "savin juniper", "fork hoe",
  "sugar maple", "heather", "reed", "sorrel", "cricket",
  "pine nut", "cork", "truffle", "olive", "shovel",
  // nivôse
  "peat", "coal", "bitumen", "sulphur", "dog",
  "lava", "topsoil", "manure", "saltpeter", "flail",
  "granite", "clay", "slate", "sandstone", "rabbit",
  "flint", "marl", "limestone", "marble", "winnowing fan",
  "gypsum", "salt", "iron", "copper", "cat",
  "tin", "lead", "zinc", "mercury", "sieve",
  // pluviôse
  "spurge-laurel", "moss", "butcher's broom", "snowdrop", "bull",
  "laurustinus", "tinder polypore", "mezereon", "poplar", "axe",
  "hellebore", "broccoli", "bay laurel", "filbert", "cow",
  "box", "lichen", "yew", "lungwort", "billhook",
  "pennycress", "rose daphne", "couch grass", "common knotgrass", "hare",
  "woad", "hazel", "cyclamen", "celandine", "sleigh",
  // ventôse
  "coltsfoot", "dogwood", "stock", "privet", "billy goat",
  "wild ginger", "Italian buckthorn", "violet", "goat willow", "spade",
  "narcissus", "elm", "common fumitory", "hedge mustard", "goat",
  "spinach", "leopard's bane", "pimpernel", "chervil", "twine",
  "mandrake", "parsley", "scurvy-grass", "daisy", "tuna",
  "dandelion", "wood anemone", "maidenhair fern", "ash", "dibber",
  // germinal
  "primrose", "plane tree", "asparagus", "tulip", "hen",
  "chard", "birch", "daffodil", "alder", "incubator",
  "periwinkle", "hornbeam", "morel", "beech", "bee",
  "lettuce", "larch", "hemlock", "radish", "beehive",
  "Judas tree", "romaine lettuce", "horse chestnut", "arugula", "pigeon",
  "lilac", "wood anemone", "pansy", "bilberry", "grafting knife",
  // floréal
  "rose", "oak", "fern", "hawthorn", "nightingale",
  "common columbine", "lily of the valley", "button mushroom", "hyacinth", "rake",
  "rhubarb", "sainfoin", "wallflower",
  "fly honeysuckle", // Chamérisier: RNR Confluence Garonne-Ariège botanical guide, p. 12: https://rnr-confluence-garonne-ariege.fr/wp-content/uploads/2023/03/NEO-Livret-A6-210622_compressed.pdf
  "silkworm",
  "comfrey", "salad burnet", "basket of gold", "orache", "weeding hoe",
  "sea thrift", "fritillary", "borage", "valerian", "carp",
  "spindle", "chives", "bugloss", "white mustard", "shepherd's crook",
  // prairial
  "lucerne", "daylily", "clover", "garden angelica", "duck",
  "lemon balm", "oat grass", "martagon lily", "wild thyme", "scythe",
  "strawberry", "betony", "pea", "acacia", "quail",
  "carnation", "elderberry", "poppy", "linden", "pitchfork",
  "cornflower", "camomile", "honeysuckle", "bedstraw", "tench",
  "jasmine", "vervain", "thyme", "peony", "handcart",
  // messidor
  "rye", "oat", "onion", "speedwell", "mule",
  "rosemary", "cucumber", "shallot", "wormwood", "sickle",
  "coriander", "artichoke",
  "wallflower", // Giroflée, not girofle: https://www.collinsdictionary.com/dictionary/french-english/giroflee
  "lavender", "chamois",
  "tobacco", "redcurrant", "hairy vetchling", "cherry", "livestock pen",
  "mint", "cumin", "bean", "alkanet", "guineafowl",
  "sage", "garlic", "vetch", "wheat", "shawm",
  // thermidor
  "spelt", "common mullein", "melon", "ryegrass", "ram",
  "horsetail", "mugwort", "safflower", "blackberry", "watering can",
  "foxtail millet", "common glasswort", "apricot", "basil", "ewe",
  "marshmallow", "flax", "almond", "gentian", "lock",
  "carline thistle", "caper", "lentil", "elecampane", "otter",
  "myrtle", "rapeseed", "lupin", "cotton", "mill",
  // fructidor
  "plum", "millet", "puffball", "six-row barley", "salmon",
  "tuberose", "winter barley", "dogbane", "liquorice", "ladder",
  "watermelon", "fennel", "European barberry", "walnut", "trout",
  "lemon", "teasel", "buckthorn", "Mexican marigold", "harvesting basket",
  "wild rose", "hazelnut", "hops", "sorghum", "crayfish",
  "bitter orange", "goldenrod", "maize", "sweet chestnut", "pack basket",
];

/** English names for the complementary days, in the order of COMPLEMENTARY in src/calendar/names.ts. */
export const ENGLISH_COMPLEMENTARY: readonly string[] = [
  "virtue",
  "talent",
  "labour",
  "convictions",
  "honours",
  "revolution",
];
