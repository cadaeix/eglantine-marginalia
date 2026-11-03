---
name: Églantine playground
description: A page with a generated garden in its own margin.
colors:
  paper: "{palette.paper}"
  ink: "{palette.ink}"
  wash: "{palette.wash}"
  accent: "{palette.accent}"
  muted: "color-mix(in oklab, {colors.ink} 68%, {colors.paper})"
  rule: "color-mix(in oklab, {colors.ink} 22%, {colors.paper})"
  default-paper: "#f4ecdd"
  default-ink: "#23201d"
  default-wash: "#603a1a"
  default-accent: "#b12e23"
typography:
  heading:
    fontFamily: "Baskervville, Georgia, serif"
    fontSize: "3rem"
    fontWeight: 400
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  gloss:
    fontFamily: "Baskervville, Georgia, serif"
    fontSize: "1.3rem"
    fontStyle: italic
  body:
    fontFamily: "Baskervville, Georgia, serif"
    fontSize: "1.0625rem"
    lineHeight: 1.55
  label:
    fontFamily: "Baskervville, Georgia, serif"
    fontVariantCaps: all-small-caps
    letterSpacing: "0.08em"
spacing:
  cm: "set from the window: about 1/25 of the page's height, 22 to 36 px"
  column: "6cm"
  gutter: "1cm"
  measure: "36rem"
components:
  setting:
    label: "{typography.label}"
    rule: "1px {colors.rule} below each line"
  words:
    unchosen: "{colors.muted}"
    chosen: "{colors.ink}, underlined"
    separator: "a middle dot in {colors.muted}"
  word-button:
    textColor: "{colors.ink}"
    underline: "{colors.rule}, {colors.ink} on hover"
  swatch:
    background: "the palette's paper, with a block of its wash and a point of its accent"
    chosen: "1px {colors.ink} outline"
  plate:
    background: "{colors.paper}"
    border: "1px {colors.rule}"
---

# Design System: Églantine playground

## Overview

The playground is a page with Églantine growing in its own margin, as it would on a visitor's website. The text column holds the day's plant and the garden's settings. The garden is grown for the page as the window lays it out: in its margin column, round the text into the room under its last line, or hanging from the top of the margin.

The page is restrained, so that the botany can be as full as its form makes it.

## Colors

The whole page takes the chosen palette's four inks: its paper is the page's background, its ink the text, its accent the sliders' points and the focus ring. Muted text and rules are mixes of ink into paper. Changing the palette or its light (daylight or candlelight) recolours the page and the garden together, and never regrows the garden.

## Typography

Self-hosted Baskervville sets everything, under the SIL Open Font License in [the font licence](gallery/fonts/OFL.txt). The heading is the day's French name, or a chosen plant's English one, with the other language beside it in italic. Labels are small capitals. Paragraphs keep to a 36rem measure.

## Layout

The page is a grid of the text column, a gutter one garden-centimetre wide and a margin column six wide. A garden-centimetre (`--cm`) is set from the window so that the page holds a column about 25 cm tall, between 22 and 36 pixels. The garden's drawing lies under the text, positioned by the script: the margin column alone, the margin and the text together at the page's foot, or the margin hanging from its top.

The garden is grown again whenever the page changes shape: a new plant, side or mode, or a window that rewraps the text. Its measurements are rounded to half a centimetre so that small shifts do not regrow it.

At 720px and narrower, the page shows the dateline, the heading and the garden, and stays at the top of the screen at 46% of its height. The paragraphs and settings follow beneath it.

## Components

Each setting is a line: a small-capital label, then words to choose among, separated by middle dots. The chosen word is inked and underlined; the others are muted. Actions are underlined words. Sliders are ruled lines with a point in the accent.

Palette swatches show each palette's paper with its wash and accent. The note beneath gives the palette's historical name and period, with its note as a title.

The plant chooser and the code are plates: native dialogs over the page, closed with their close word or Escape. The plant chooser draws each plant by its telling part, its bloom, a leaf or the foot it stands on.

## Do's and Don'ts

- Do show the garden on a page with real text, in a real margin.
- Do keep the settings typeset as part of the page.
- Do give each calendar day its French name and its English one.
- Don't give the interface colours of its own; the palette colours the page.
- Don't regrow the garden for a change of colour or moment.
- Don't rely on colour alone to show a choice: chosen words are underlined, the chosen swatch is outlined.
