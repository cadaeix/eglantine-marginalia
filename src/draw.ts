// Drawing with any manner by its id, the screen manners among them, as well as a manner passed in: the main entry's
// renderGarden and paintShapes. The painting itself is in render.ts and paint.ts, which load no screen manner, so
// the light entry carries the screen manners only once a page loads one.
import type { Garden } from "./garden.js";
import { type Manner, type MannerInput, type MannerModule, paintShapes as paintLoaded, type Part, type PeriodManner, type ScreenManner, type Sheet } from "./paint.js";
import { type Moment, renderGarden as renderLoaded, type RenderOptions as LoadedRenderOptions } from "./render.js";
import { SCREEN_MANNERS } from "./screen.js";
import type { Shape } from "./shapes.js";

/** How to draw a garden; the manner may be any manner's id, or a manner passed in. */
export interface RenderOptions extends Omit<LoadedRenderOptions, "manner"> {
  manner: Manner | MannerModule;
}

/** A manner by any id, as painting takes it: a screen manner's id becomes the screen manner itself. */
export function mannerInput(manner: Manner | MannerModule): MannerInput {
  if (typeof manner !== "string") return manner;
  return Object.hasOwn(SCREEN_MANNERS, manner) ? SCREEN_MANNERS[manner as ScreenManner] : manner as PeriodManner;
}

/** A garden at one moment as SVG, in any manner by its id or a manner passed in. */
export function renderGarden(garden: Garden, moment: Moment, options: RenderOptions): string {
  return renderLoaded(garden, moment, { ...options, manner: mannerInput(options.manner) });
}

/** A motif's shapes in any manner by its id or a manner passed in, as `part` of the plant. */
export function paintShapes(shapes: readonly Shape[], manner: Manner | MannerModule, sheet: Sheet, part?: Part): string {
  return paintLoaded(shapes, mannerInput(manner), sheet, part);
}
