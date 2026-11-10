import { type CalendarGuest, HANAMI } from "../src/calendar/index.js";
import type { Variant } from "../src/form.js";

export interface PlantChoice {
  readonly id: string;
  readonly name: string;
  readonly french: string;
  readonly description: string;
  readonly form: string;
  readonly variant: Variant;
  /** The part the chooser draws: the bloom at the stem's end, a leaf, or the foot the plant stands on. */
  readonly part: "bloom" | "leaf" | "foot";
  /** An animal that visits it, as a calendar day's guest does. */
  readonly guest?: CalendarGuest;
  /** Left out of the plant chooser: reached by a link, or by typing its name on the page. */
  readonly hidden?: true;
}

export const PLANTS: readonly PlantChoice[] = [
  { id: "rose", name: "Rose", french: "la rose", part: "bloom", description: "A woody shrub with prickly stems, pinnate leaves and a many-petalled flower.", form: "rosacee-coupe", variant: { rings: 2, breadth: 0.55, cup: 0.5, boss: "dense", seed: "hip", leaf: "pinnate", prickles: true, woody: true, size: 1.3 } },
  { id: "ivy", name: "Ivy", french: "le lierre", part: "leaf", description: "A woody climber with lobed leaves that cling to a support.", form: "grimpante", variant: { attach: "clinging", leaf: "ivy", lobes: 0.4, bloom: "umbel", woody: true } },
  { id: "maidenhair-fern", name: "Maidenhair fern", french: "le capillaire", part: "leaf", description: "A fern frond bears small leaflets along a branching stem.", form: "cryptogame", variant: { mode: "maidenhair" } },
  { id: "sunflower", name: "Sunflower", french: "le tournesol", part: "bloom", description: "A large flower head carries a ring of rays around a broad central disc.", form: "capitule", variant: { rays: 24, rayLength: 0.4, disc: 0.3, leaf: "simple", basal: false, seed: "dry", size: 1.5 } },
  { id: "tulip", name: "Tulip", french: "la tulipe", part: "bloom", description: "A single cup-shaped flower rises above long strap-like leaves.", form: "lis-bulbe", variant: { tepalWidth: 0.3, strap: 2, stemLeaves: true, size: 1.2 } },
  { id: "lily-of-the-valley", name: "Lily of the valley", french: "le muguet", part: "bloom", description: "Small bell-shaped flowers hang in a row above broad leaves.", form: "lis-bulbe", variant: { flower: "bell", tepalWidth: 0.32, facing: "nod", cluster: "raceme", flowers: 7, lip: 0.3, arch: 0.7, seed: "berries", leaf: "broad", bulb: "none", height: 0.5, size: 1.2 } },
  { id: "apple", name: "Apple", french: "la pomme", part: "bloom", description: "A round pome hangs from a leafy fruiting branch.", form: "arbre-fruitier", variant: { fruit: "pome", calyx: "eye", surface: "speckled", leaf: "serrate", stalk: 0.9 } },
  { id: "pear", name: "Pear", french: "la poire", part: "bloom", description: "A pear-shaped pome hangs from a leafy fruiting branch.", form: "arbre-fruitier", variant: { fruit: "pear", calyx: "eye", surface: "speckled", leaf: "simple", breadth: 1.1, stalk: 1.3, elong: 1.15 } },
  { id: "cherry-blossom", name: "Cherry blossom", french: "le cerisier en fleur", part: "bloom", description: "Clusters of notched five-petalled flowers open along a slender shoot, and shed their petals towards evening.", form: "arbre-fruitier", variant: { fruit: "drupe", cluster: "pair", size: 0.75, surface: "glossy", stalk: 2.2, leaf: "serrate", breadth: 0.85, blossom: true } },
  { id: "hanami", name: "Hanami", french: "le lapin et le cerisier en fleur", part: "bloom", hidden: true, guest: HANAMI.guest, description: "A wild rabbit comes to see the cherry in blossom, and stays to watch its petals fall.", form: HANAMI.plant.form, variant: HANAMI.plant.variant },
  { id: "wheat", name: "Wheat", french: "le blé", part: "bloom", description: "A grass stem ends in a dense head of grain-bearing spikelets.", form: "epi-graminee", variant: { density: 1.3, nod: 0.15 } },
  { id: "lavender", name: "Lavender", french: "la lavande", part: "bloom", description: "Small lipped flowers cluster in a spike above narrow leaves.", form: "epi-aromatique", variant: { inflorescence: "spike", corolla: "lipped", leaf: "linear", opposite: true, habit: "shrub", size: 0.9, flowers: 1.4, length: 0.8, bare: 0.45, hairy: true } },
  { id: "elder", name: "Elder", french: "le sureau", part: "bloom", description: "A flat-topped cluster of small flowers sits above divided leaves.", form: "ombelle-corymbe", variant: { leaf: "pinnate" } },
  { id: "juniper", name: "Juniper", french: "le genévrier", part: "bloom", description: "An evergreen conifer with short needles and berry-like cones.", form: "conifere", variant: { needles: "whorl", needle: 0.34, cone: "berry", coneSize: 0.75, posture: "spreading" } },
  { id: "truffle", name: "Truffle", french: "la truffe", part: "foot", description: "A dark, irregular fruiting body develops underground.", form: "cryptogame", variant: { mode: "truffle", habit: "ground" } },
  { id: "hazel", name: "Hazel", french: "le noisetier", part: "leaf", description: "A branching shrub has broad heart-shaped leaves and double-toothed edges.", form: "feuillage", variant: { habit: "shrub", leaf: "heart", width: 0.85, margin: "double" } },
  { id: "clover", name: "Clover", french: "le trèfle", part: "bloom", description: "Rounded flower heads rise above leaves in groups of three.", form: "epi-aromatique", variant: { inflorescence: "head", corolla: "pea", fruit: "dry", leaf: "trifoliate", size: 0.9 } },
  { id: "carrot", name: "Carrot", french: "la carotte", part: "foot", description: "A long tapering root grows beneath finely divided foliage.", form: "racine-tubercule", variant: { habit: "long", heart: true } },
  { id: "moss", name: "Moss", french: "la mousse", part: "bloom", description: "A low cushion of moss sends up slender stalks capped with spore cases.", form: "cryptogame", variant: { mode: "moss" } },
  { id: "granite", name: "Granite", french: "le granit", part: "foot", description: "A cut section of coarse-grained granite shows mineral speckles.", form: "hiver", variant: { mode: "section", bed: "granit", habit: "lump", texture: "grains", tone: 0.45, twig: "bare" } },
];

/** What each form draws, as the end of a sentence: "The garden draws it as …". */
export const FORM_PHRASES: Readonly<Record<string, string>> = {
  "arbre-fruitier": "a fruiting shoot, its fruit budding, swelling and ripening",
  capitule: "a composite flower head that goes to a clock of seeds or a dry head",
  conifere: "a needled or scaled spray with its cones",
  cryptogame: "a fungus, moss, lichen or fern",
  "epi-aromatique": "an upright stem of small flowers in spikes, whorls or heads",
  "epi-graminee": "a grass under its ears",
  feuillage: "a plant known by its leaves",
  grimpante: "a climber, held by tendrils, twining stems or rootlets",
  hiver: "a section of rock, earth or metal under bare winter twigs",
  "lis-bulbe": "a flower on a scape above its bulb",
  "ombelle-corymbe": "a flat-topped cluster of small flowers",
  "racine-tubercule": "a plant known by its root or tuber",
  "rosacee-coupe": "a cupped flower that goes to a hip, a haw or a capsule",
};
