// The engraved figures for the animal and tool days: each name is a PNG in the package's figures/ folder,
// an ink mask whose ink is opaque and whose paper is transparent, drawn facing right. Its provenance is in
// figures/PROVENANCE.md.
import type { GuestStance } from "../garden.js";

export interface FigureRow {
  /** An animal visits the plant; a tool lies at rest at its foot. */
  readonly kind: "visitor" | "rest";
  /**
   * Where an animal stands: on a shoot that coils out of a stem for it, as the beasts and birds do; among the
   * stems, as the bee flies, the fish swim and the silkworm keeps to its leaf; or on the ground, as the otter,
   * too long for any shoot, does. A tool has none.
   */
  readonly stance?: GuestStance;
  /** Width over height. */
  readonly aspect: number;
}

export const FIGURES: Readonly<Record<string, FigureRow>> = {
  abeille: { kind: "visitor", stance: "stems", aspect: 1.2333 },
  ane: { kind: "visitor", stance: "shoot", aspect: 1.2472 },
  arrosoir: { kind: "rest", aspect: 1.0778 },
  beche: { kind: "rest", aspect: 4.1667 },
  belier: { kind: "visitor", stance: "shoot", aspect: 1.1917 },
  boeuf: { kind: "visitor", stance: "shoot", aspect: 1.2632 },
  bouc: { kind: "visitor", stance: "shoot", aspect: 1.0722 },
  brebis: { kind: "visitor", stance: "shoot", aspect: 1.3417 },
  caille: { kind: "visitor", stance: "shoot", aspect: 0.8861 },
  canard: { kind: "visitor", stance: "shoot", aspect: 0.9806 },
  carpe: { kind: "visitor", stance: "stems", aspect: 2.5806 },
  chalemie: { kind: "rest", aspect: 1.4041 },
  chamois: { kind: "visitor", stance: "shoot", aspect: 1.0167 },
  chariot: { kind: "rest", aspect: 0.4444 },
  charrue: { kind: "rest", aspect: 1.7578 },
  chat: { kind: "visitor", stance: "shoot", aspect: 1.4 },
  cheval: { kind: "visitor", stance: "shoot", aspect: 1.0806 },
  chevre: { kind: "visitor", stance: "shoot", aspect: 1.075 },
  chevreuil: { kind: "visitor", stance: "shoot", aspect: 0.9278 },
  chien: { kind: "visitor", stance: "shoot", aspect: 1.5583 },
  cochon: { kind: "visitor", stance: "shoot", aspect: 1.6778 },
  cognee: { kind: "rest", aspect: 3.0612 },
  cordeau: { kind: "rest", aspect: 1.5484 },
  couvoir: { kind: "rest", aspect: 0.6044 },
  crible: { kind: "rest", aspect: 1.4803 },
  cuve: { kind: "rest", aspect: 1.495 },
  dindon: { kind: "visitor", stance: "shoot", aspect: 0.9972 },
  echelle: { kind: "rest", aspect: 2.2222 },
  ecluse: { kind: "rest", aspect: 0.8467 },
  ecrevisse: { kind: "visitor", stance: "shoot", aspect: 1.575 },
  faisan: { kind: "visitor", stance: "shoot", aspect: 1.0472 },
  faucille: { kind: "rest", aspect: 1.5177 },
  faux: { kind: "rest", aspect: 2.5641 },
  fleau: { kind: "rest", aspect: 8.4906 },
  fourche: { kind: "rest", aspect: 7.0866 },
  greffoir: { kind: "rest", aspect: 6.4286 },
  grillon: { kind: "visitor", stance: "shoot", aspect: 1.1667 },
  herse: { kind: "rest", aspect: 1.1407 },
  hotte: { kind: "rest", aspect: 1.9149 },
  houlette: { kind: "rest", aspect: 13.3333 },
  hoyau: { kind: "rest", aspect: 1.6484 },
  lapin: { kind: "visitor", stance: "shoot", aspect: 1.9111 },
  lievre: { kind: "visitor", stance: "shoot", aspect: 1.6 },
  loutre: { kind: "visitor", stance: "ground", aspect: 2.9917 },
  moulin: { kind: "rest", aspect: 0.69 },
  mulet: { kind: "visitor", stance: "shoot", aspect: 1.1583 },
  oie: { kind: "visitor", stance: "shoot", aspect: 1.1278 },
  panier: { kind: "rest", aspect: 1.0753 },
  parc: { kind: "rest", aspect: 1.528 },
  pelle: { kind: "rest", aspect: 9.5745 },
  pigeon: { kind: "visitor", stance: "shoot", aspect: 0.9833 },
  pintade: { kind: "visitor", stance: "shoot", aspect: 0.6333 },
  pioche: { kind: "rest", aspect: 1.2363 },
  plantoir: { kind: "rest", aspect: 2.9605 },
  poule: { kind: "visitor", stance: "shoot", aspect: 0.775 },
  pressoir: { kind: "rest", aspect: 1.7013 },
  rateau: { kind: "rest", aspect: 5.4878 },
  rossignol: { kind: "visitor", stance: "shoot", aspect: 1.1833 },
  rouleau: { kind: "rest", aspect: 2.6012 },
  ruche: { kind: "rest", aspect: 0.7022 },
  sarcloir: { kind: "rest", aspect: 1.8908 },
  saumon: { kind: "visitor", stance: "stems", aspect: 2.7806 },
  serpette: { kind: "rest", aspect: 2.0548 },
  tanche: { kind: "visitor", stance: "stems", aspect: 2.8778 },
  taureau: { kind: "visitor", stance: "shoot", aspect: 1.6306 },
  thon: { kind: "visitor", stance: "stems", aspect: 2.95 },
  tonneau: { kind: "rest", aspect: 1.5101 },
  traineau: { kind: "rest", aspect: 2.5532 },
  truite: { kind: "visitor", stance: "stems", aspect: 3.4444 },
  vache: { kind: "visitor", stance: "shoot", aspect: 1.3873 },
  van: { kind: "rest", aspect: 1.9108 },
  "ver-a-soie": { kind: "visitor", stance: "stems", aspect: 6.4667 },
};
