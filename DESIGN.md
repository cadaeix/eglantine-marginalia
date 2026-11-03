---
name: Églantine playground
description: Generated botanical gardens beside a reading sample.
colors:
  surface: "#eeeee5"
  ink: "#2d4033"
  muted: "#5b6559"
  line: "#b9bfb0"
  soft: "#e0e4d8"
  selected: "#d3ddcb"
  accent: "#35513c"
  on-accent: "#faf9ef"
  error: "#9b332a"
  dark-surface: "#1d2620"
  dark-ink: "#e4e7d8"
  dark-muted: "#b9c1af"
  dark-line: "#586451"
  dark-soft: "#27332b"
  dark-selected: "#374831"
  dark-accent: "#d3dfc1"
  dark-on-accent: "#1d2c20"
  dark-error: "#ffb2a7"
typography:
  display:
    fontFamily: "Baskervville, Georgia, serif"
    fontSize: "clamp(2.7rem, 3.7vw, 4.1rem)"
    fontWeight: 400
    lineHeight: 0.99
    letterSpacing: "-0.035em"
  wordmark:
    fontFamily: "Baskervville, Georgia, serif"
    fontSize: "2.65rem"
    lineHeight: 1
    letterSpacing: "-0.035em"
  body:
    fontFamily: "Baskervville, Georgia, serif"
    fontSize: "1.02rem"
    lineHeight: 1.55
  button:
    fontFamily: '"Segoe UI", "Helvetica Neue", sans-serif'
    fontSize: "0.85rem"
  palette-label:
    fontFamily: '"Segoe UI", "Helvetica Neue", sans-serif'
    fontSize: "0.8rem"
    lineHeight: 1.2
rounded:
  control: "3px"
  choice: "2px"
spacing:
  button-block: "0.5rem"
  button-inline: "0.85rem"
  frame: "1.4rem"
  outer: "3rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.85rem"
  button-primary-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "0.5rem 0.85rem"
  palette-choice:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.choice}"
    padding: "0.15rem"
---

# Design System: Églantine playground

## Overview

The playground follows the approved interactive botanical plate direction. Generated engraving and wash drawings provide its illustration. Fine rules and restrained controls surround a page preview that pairs a garden with text.

English names identify the public choices. Historical French names remain secondary information. Plant thumbnails and named palette swatches let visitors inspect choices before selecting them.

## Colors

The interface uses subdued green surfaces and ink. The selected garden uses the library's palette-specific paper, ink, wash, and accent independently of the surrounding interface. Light and dark readings change both sets of colours.

The accent marks selected controls and the primary export action. Muted ink distinguishes supporting text. Error ink identifies failed actions and invalid dates. The colours and their roles are implemented in [the playground stylesheet](gallery/playground.css).

## Typography

Self-hosted Baskervville supplies the wordmark, specimen prose, plant names, and section titles. Its normal and italic variable fonts are bundled under the SIL Open Font License in [the font licence](gallery/fonts/OFL.txt). Functional controls use Segoe UI with Helvetica Neue and sans-serif fallbacks.

The root font size is 15px. Palette labels use 0.8rem, equivalent to 12px, and wrap within their buttons. The specimen prose has a maximum width of 38ch. Phone layouts retain the heading, introductory passage, and plant caption while hiding the longer sample prose.

## Layout

The desktop layout reserves a narrow column for controls beside a flexible preview. The layout has a maximum width of 1560px.

| Viewport width | Control column width |
|---|---|
| Above 760px through 1100px | 315px |
| Above 1100px and below 1600px | 345px |
| 1600px and wider | 370px |

At widths up to 760px, the preview stays above the controls during scrolling. The page preview height follows 40svh within limits of 200px and 340px. Scroll padding places focused controls below the preview. The preview stops sticking when the viewport height is at most 500px within this phone layout.

The garden retains its SVG aspect ratio when the page margin changes. Moving the garden to the left swaps the text and garden columns. Page placement does not change the library's botanical composition.

## Elevation & Depth

The page preview uses a soft surrounding frame and the shadow `0 8px 22px #18241b0d`. Controls remain flat. A selected plant button adds an inset accent border to distinguish selection without relying on colour alone.

## Shapes

Controls use restrained rectangular shapes with 2px or 3px corner radii. Thin rules divide functional groups. Icons use inline stroked SVG, and disclosure arrows use two border strokes.

## Components

Plant buttons show generated botanical thumbnails and English names. Selection uses an accent border and a tinted background. Additional plants appear in a disclosure below the initial selection.

Palette buttons show paper behind separate ink, wash, and accent samples. Names remain visible beneath the samples. The selected palette receives an accent border, and its historical name appears in supporting text.

The primary button exports an SVG. The adjacent secondary button copies a shareable link. Clipboard denial reveals a selectable text field, and action status text reports success or failure. Disabled controls reduce opacity and do not accept input.

Native radio groups control mutually exclusive settings. Native details elements hide page placement, growth, and code controls until requested. The calendar uses a labelled date field and an inline error message.

Keyboard focus uses a 2px accent outline. Colour transitions run for 120ms or 160ms with ease-out timing when reduced motion is not requested. The skip link focuses the controls without changing the shared garden settings.

## Do's and Don'ts

- Do use generated gardens as the primary artwork.
- Do show English names alongside visual choices.
- Do show palette names and swatches together.
- Do preserve the SVG aspect ratio when adjusting page margins.
- Do leave advanced controls inside their disclosures.
- Don't replace the botanical artwork with generic decorative illustrations.
- Don't use historical French terminology as the sole label for a public control.
- Don't rely on colour alone to distinguish selected controls.
