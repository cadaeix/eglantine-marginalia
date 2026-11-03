import type { Variant } from "../src/form.js";

export interface PlantChoice {
  readonly id: string;
  readonly name: string;
  readonly french: string;
  readonly description: string;
  readonly form: string;
  readonly variant: Variant;
}

export const PLANTS: readonly PlantChoice[] = [
  { id: "rose", name: "Rose", french: "Rose", description: "A woody shrub with prickly stems, pinnate leaves and a many-petalled flower.", form: "rosacee-coupe", variant: { rings: 2, breadth: 0.55, cup: 0.5, boss: "dense", seed: "hip", leaf: "pinnate", prickles: true, woody: true, size: 1.3 } },
  { id: "ivy", name: "Ivy", french: "Lierre", description: "A woody climber with lobed leaves that cling to a support.", form: "grimpante", variant: { attach: "clinging", leaf: "ivy", lobes: 0.4, bloom: "umbel", woody: true } },
  { id: "maidenhair-fern", name: "Maidenhair fern", french: "Capillaire", description: "A fern frond bears small leaflets along a branching stem.", form: "cryptogame", variant: { mode: "maidenhair" } },
  { id: "sunflower", name: "Sunflower", french: "Tournesol", description: "A large flower head carries a ring of rays around a broad central disc.", form: "capitule", variant: { rays: 24, rayLength: 0.4, disc: 0.3, leaf: "simple", basal: false, seed: "dry", size: 1.5 } },
  { id: "tulip", name: "Tulip", french: "Tulipe", description: "A single cup-shaped flower rises above long strap-like leaves.", form: "lis-bulbe", variant: { tepalWidth: 0.3, strap: 2, stemLeaves: true, size: 1.2 } },
  { id: "lily-of-the-valley", name: "Lily of the valley", french: "Muguet", description: "Small bell-shaped flowers hang in a row above broad leaves.", form: "lis-bulbe", variant: { flower: "bell", tepalWidth: 0.32, facing: "nod", cluster: "raceme", flowers: 7, lip: 0.3, arch: 0.7, seed: "berries", leaf: "broad", bulb: "none", height: 0.5, size: 1.2 } },
  { id: "apple", name: "Apple", french: "Pomme", description: "A round pome hangs from a leafy fruiting branch.", form: "arbre-fruitier", variant: { fruit: "pome", calyx: "eye", surface: "speckled", leaf: "serrate", stalk: 0.9 } },
  { id: "pear", name: "Pear", french: "Poire", description: "A pear-shaped pome hangs from a leafy fruiting branch.", form: "arbre-fruitier", variant: { fruit: "pear", calyx: "eye", surface: "speckled", leaf: "simple", breadth: 1.1, stalk: 1.3, elong: 1.15 } },
  { id: "wheat", name: "Wheat", french: "Blé", description: "A grass stem ends in a dense head of grain-bearing spikelets.", form: "epi-graminee", variant: { density: 1.3, nod: 0.15 } },
  { id: "lavender", name: "Lavender", french: "Lavande", description: "Small lipped flowers cluster in a spike above narrow leaves.", form: "epi-aromatique", variant: { inflorescence: "spike", corolla: "lipped", leaf: "linear", opposite: true, habit: "shrub", size: 0.9, flowers: 1.4, length: 0.8, bare: 0.45, hairy: true } },
  { id: "elder", name: "Elder", french: "Sureau", description: "A flat-topped cluster of small flowers sits above divided leaves.", form: "ombelle-corymbe", variant: { leaf: "pinnate" } },
  { id: "juniper", name: "Juniper", french: "Genévrier", description: "An evergreen conifer with short needles and berry-like cones.", form: "conifere", variant: { needles: "whorl", needle: 0.34, cone: "berry", coneSize: 0.75, posture: "spreading" } },
  { id: "truffle", name: "Truffle", french: "Truffe", description: "A dark, irregular fruiting body develops underground.", form: "cryptogame", variant: { mode: "truffle", habit: "ground" } },
  { id: "hazel", name: "Hazel", french: "Noisetier", description: "A branching shrub has broad heart-shaped leaves and double-toothed edges.", form: "feuillage", variant: { habit: "shrub", leaf: "heart", width: 0.85, margin: "double" } },
  { id: "clover", name: "Clover", french: "Trèfle", description: "Rounded flower heads rise above leaves in groups of three.", form: "epi-aromatique", variant: { inflorescence: "head", corolla: "pea", fruit: "dry", leaf: "trifoliate", size: 0.9 } },
  { id: "carrot", name: "Carrot", french: "Carotte", description: "A long tapering root grows beneath finely divided foliage.", form: "racine-tubercule", variant: { habit: "long", heart: true } },
  { id: "moss", name: "Moss", french: "Mousse", description: "A low cushion of moss sends up slender stalks capped with spore cases.", form: "cryptogame", variant: { mode: "moss" } },
  { id: "granite", name: "Granite", french: "Granit", description: "A cut section of coarse-grained granite shows mineral speckles.", form: "hiver", variant: { mode: "section", bed: "granit", habit: "lump", texture: "grains", tone: 0.45, twig: "bare" } },
];

export const PALETTE_LABELS: Readonly<Record<string, { readonly name: string; readonly description: string }>> = {
  puce: { name: "Rose brown", description: "Warm brown ink and paper, with rose-red accents." },
  olive: { name: "Olive green", description: "Olive greens and earthy brown, touched with amber." },
  cockade: { name: "Forest green", description: "Leaf green and Paris red against warm paper." },
  "iron-gall": { name: "Iron-gall brown", description: "Deep manuscript brown with sealing-wax red." },
  pansy: { name: "Pansy violet", description: "Violet washes with a jonquil-yellow accent." },
  porcelain: { name: "Porcelain blue", description: "Blue washes and a small gilded accent." },
  madder: { name: "Madder red", description: "Madder-red washes and indigo-blue details." },
  "red-chalk": { name: "Red chalk", description: "Soot-brown ink with red-chalk touches." },
};

export const FORM_LABELS: Readonly<Record<string, string>> = {
  "arbre-fruitier": "Fruit tree",
  capitule: "Flower head",
  conifere: "Conifer",
  cryptogame: "Spore-bearing plants and fungi",
  "epi-aromatique": "Aromatic flower spike",
  "epi-graminee": "Grass and grain",
  feuillage: "Foliage",
  grimpante: "Climber",
  hiver: "Winter earth and minerals",
  "lis-bulbe": "Bulb flower",
  "ombelle-corymbe": "Umbel and corymb",
  "racine-tubercule": "Root and tuber",
  "rosacee-coupe": "Cupped flower",
};
