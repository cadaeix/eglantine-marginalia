# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Visitors discover Églantine through shared gardens and personal websites. The public playground lets them explore the artwork without knowledge of French, botanical form identifiers, or the library API. Developers can export a garden and inspect the rendering example.

## Product Purpose

Églantine generates seeded SVG margin gardens in the manner of eighteenth-century French engraving and ink wash. Time reveals stems and flowers. Fullness reveals foliage without withholding flowers from a quiet day.

## Capabilities and Constraints

The public playground starts with a curated selection of familiar plants shown as thumbnails and English names. Named swatches show palette colours. The calendar and detailed specimen gallery remain available. Controls remain limited to choices that affect the visible garden or its placement beside text.

The TypeScript library has no runtime dependencies and does not require a DOM. The playground uses Vite. Its static build must support a subdirectory on GitHub Pages and hosting on a personal website. The bundled forms retain their existing column dimensions, so preview margins must scale them without distortion.

The user selected a code-led workflow with real generated gardens, followed by desktop and phone inspection. Native trailing growth and broader botanical composition are separate library features, outside this playground change.

## Brand Commitments

The French historical names remain available as secondary information. Eighteenth-century botanical engraving, the library's palettes, and the generated plants supply the visual identity. The public controls use plain English.

## Evidence on Hand

The library source and gallery examples supply the rendered artwork. The README, historical palette data, and figure provenance records supply its descriptions and credits. The tikz-flora mixer is an interaction reference for an artwork preview that remains visible while controls are used.

## Product Principles

- Display real generated artwork from the first view.
- Use visual choices before technical terminology.
- Preserve the garden's composition when changing its colour or moment.
- Keep the preview and controls usable with touch, keyboard, and narrow screens.
- Export the garden represented by the current settings.
