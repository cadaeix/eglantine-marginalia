// Églantine: margin gardens in the manner of eighteenth-century French engraving. Grow a garden from a seed
// and a plant form, then render it at any moment of the day as SVG.
export { COLUMN, foliageShown, type Garden, type GardenItem, growGarden, type GrowSpec, type Guest, type GuestPlace, type GuestStance, type MotifItem, type Page, stageAt, stemShown, type StemItem } from "./grow.js";
export { type Festival, type FestivalModule, FESTIVALS } from "./festival.js";
export { type Decorations, type Inlay, type Moment, renderGarden, type RenderOptions } from "./render.js";
export { type Manner, paintShapes, Sheet } from "./paint.js";
export { DEFAULT_INKS, INK_PROPERTIES, inkRef, type Inks, withInks } from "./inks.js";
export { type Palette, PALETTES, paletteInks, palettesCss } from "./palettes.js";
export { FESTIVAL_MODULES, FORM_MODULES, plantForm } from "./registry.js";
export { flagOf, type Foot, type FormModule, LAYER, type MotifRow, numberOf, type PlantForm, resolveVariant, type Stage, type StemInk, textOf, type Variant, type VariantKey, type VariantValue } from "./form.js";
export { createRng, type Rng, seedFromText } from "./random.js";
export type { Body, Dots, Line, Shape, Solid, Tone } from "./shapes.js";
