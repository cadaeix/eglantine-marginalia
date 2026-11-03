// Drawing a form's parts on their own, as the specimens and the playground's plant chooser show them.
import { num, type Pt } from "../src/geometry.js";
import { type Manner, paintShapes, Sheet } from "../src/paint.js";
import type { Shape } from "../src/shapes.js";

function points(shape: Shape): Pt[] {
  switch (shape.type) {
    case "body": return shape.outline;
    case "solid": return shape.outline;
    case "line": return shape.points;
    case "dots": return shape.points;
  }
}

/** Shapes drawn alone, framed to their own bounds, at `scale` pixels per centimetre. */
export function shapesSvg(shapes: Shape[], manner: Manner, id: string, scale: number): string {
  const all = shapes.flatMap(points);
  if (all.length === 0) return "";
  const pad = 0.1;
  const x0 = Math.min(...all.map(p => p[0])) - pad, x1 = Math.max(...all.map(p => p[0])) + pad;
  const y0 = Math.min(...all.map(p => p[1])) - pad, y1 = Math.max(...all.map(p => p[1])) + pad;
  const sheet = new Sheet(id);
  const body = paintShapes(shapes, manner, sheet);
  return `<svg xmlns="http://www.w3.org/2000/svg" class="eglantine" viewBox="${num(x0)} ${num(-y1)} ${num(x1 - x0)} ${num(y1 - y0)}" width="${num((x1 - x0) * scale)}" height="${num((y1 - y0) * scale)}">`
    + `<defs>${sheet.defs.join("")}</defs><g transform="scale(1 -1)">${body}</g></svg>`;
}
