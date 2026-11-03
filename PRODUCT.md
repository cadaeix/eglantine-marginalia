# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Visitors discover Églantine through shared gardens and personal websites. The public playground lets them explore the artwork without knowledge of French, botanical form identifiers, or the library API. Developers can save a garden and copy the code that grows it.

## Product Purpose

Églantine generates seeded SVG margin gardens in the manner of eighteenth-century French engraving and ink wash. Time reveals stems and flowers. Fullness reveals foliage without withholding flowers from a quiet day. Given the page beside it, a garden grows round the text into the room it leaves.

## Capabilities and Constraints

The playground is a page with a garden in its own margin. It opens on the day's plant from the French Republican calendar, at the visitor's hour, and offers eighteen familiar plants beside the calendar. The garden keeps to its margin, grows round the text, or hangs from the top of the margin.

The TypeScript library has no runtime dependencies and does not require a DOM; the playground measures its page and hands the library the geometry in centimetres. The playground uses Vite. Its static build must support a subdirectory on GitHub Pages and hosting on a personal website.

## Brand Commitments

Each calendar day carries its French name and its English one. The palettes keep their historical names and periods. Eighteenth-century botanical engraving, the library's palettes, and the generated plants supply the visual identity. The text is plain and concrete, in the voice of the README.

## Evidence on Hand

The library source and gallery examples supply the rendered artwork. The README, historical palette data, and figure provenance records supply its descriptions and credits. The English day names come from Wikipedia's tables of the French Republican calendar. Kevin Raymond's florilegium is the model for a garden that fills the space a page leaves.

## Product Principles

- Display real generated artwork, on a real page, from the first view.
- Let the garden fill the room the text leaves.
- Preserve the garden's composition when changing its colour or moment.
- Keep the page and its settings usable with touch, keyboard, and narrow screens.
- Save the garden represented by the current settings.
