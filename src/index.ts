// Églantine: margin gardens in the manner of eighteenth-century French engraving. Grow a garden from a seed
// and a plant form, then render it at any moment of the day as SVG.
export { type Anchor, COLUMN, type ColumnSegment, foliageShown, type Garden, type GardenItem, growGarden, type GrowSpec, type Guest, type GuestPlace, type GuestStance, type MotifItem, type Ornament, ORNAMENTS, type Page, stageAt, stemShown, type StemItem } from "./grow.js";
export { type Festival, type FestivalModule, FESTIVALS } from "./festival.js";
export { type Decorations, type Inlay, type Moment } from "./render.js";
export { mannerInput, paintShapes, renderGarden, type RenderOptions } from "./draw.js";
export { loadManner } from "./load-manner.js";
export { type FigureInk, type Manner, type MannerInput, type MannerModule, MANNERS, type MannerStyle, type Part, type PeriodManner, type ScreenManner, Sheet } from "./paint.js";
export { DEFAULT_INKS, INK_PROPERTIES, inkRef, type Inks, withInks } from "./inks.js";
export { type Palette, PALETTES, paletteInks, palettesCss } from "./palettes.js";
export { FESTIVAL_MODULES, FORM_MODULES, plantForm } from "./registry.js";
export { flagOf, type Foot, type FormModule, LAYER, type MotifRow, numberOf, type PlantForm, resolveVariant, type Stage, type StemInk, textOf, type Variant, type VariantKey, type VariantValue } from "./form.js";
export { createRng, type Rng, seedFromText } from "./random.js";
export type { Body, Dots, Line, Shape, Solid, Tone } from "./shapes.js";
