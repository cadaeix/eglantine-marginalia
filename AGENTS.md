# Églantine: notes for agents

Églantine (`eglantine-marginalia`) grows a plant procedurally in the margin of a page and draws it as an SVG string in the manner of eighteenth-century French engraving. The calendar entry gives every day of the French Republican calendar its plant, and animal and tool days a guest cut from a period engraving. It was built for Camille, a persistent agent in Cad's literary project, and he is a source of ideas for it. It is on its way to npm.

Read these before broad exploration:

- `README.md`: the library, its API and its history. It is the voice to write in.
- `DESIGN.md`: how the playground looks and behaves.
- `figures/PROVENANCE.md`: where every guest figure comes from, and the rights of its scan.

## Commands

```sh
npm test                 # vitest; about 40 s, since many tests grow all 288 calendar plants
npm run typecheck
npm run check            # typecheck, tests, library build and site build: run before a commit
npm run gallery          # playground at http://localhost:5210
npm run gallery:preview  # the built site on the same port; stop the dev server first
```

`dist/` and `site-dist/` are build outputs and are not committed. `npm run build` also writes `dist/palettes.css` through `scripts/palettes-css.mjs`.

## Where things are

| Path | Holds |
|---|---|
| `src/garden.ts` | the growth loop, after florilegium; loads no forms |
| `src/grow.ts`, `src/index.ts` | the main entry: `growGarden` by registered form id |
| `src/lite.ts`, `src/load-form.ts` | the light entry: forms loaded one at a time |
| `src/render.ts`, `src/paint.ts` | a garden at one moment as SVG, in `taille-douce` or `lavis` |
| `src/form.ts`, `src/kit.ts`, `src/toolkit.ts` | what a form is, and the shared kit forms are built with |
| `src/forms/<id>.form.ts` | the thirteen plant forms |
| `src/festival.ts`, `src/festivals/<id>.ts` | the six festivals of the complementary days, each done to a plant |
| `src/calendar/` | Republican dates, day names, the plant table and the figure table |
| `src/palettes.ts`, `src/inks.ts` | the eight palettes and the four CSS inks |
| `gallery/` | the playground and the specimen gallery (Vite); the only code that touches a DOM |
| `figures/` | guest PNGs and their provenance |
| `test/` | vitest suites |

## What must stay true

The tests hold most of these. Keep them holding rather than loosening a test.

- **The core is pure.** No runtime dependencies, and nothing under `src/` uses the DOM: a garden must grow and render in a browser, a worker or Node. The gallery measures the page and hands the library centimetres.
- **A seed is a garden.** The same spec grows the same garden. The guest draws from its own random stream, so placing one never shifts the layout's other draws.
- **A moment only reveals.** The layout is fixed at growth; `t` and `fullness` only reveal it. Nothing shown at one moment disappears at a later time or a greater fullness. A quiet day shows fewer leaves (never under 30%) and the same blooms.
- **The column is the unit.** Forms are drawn for the 6 × 22 cm column, with sizes in centimetres. Plants keep inside it and leave its top fifth as sky. On a page, the garden never draws over the text, and a right-hand page is the mirror of a left-hand one.
- **Colour and moment never regrow.** Changing the palette, its light, `t` or `fullness` must not regrow the garden, in the library or the playground.
- **Strict TypeScript.** `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` and `verbatimModuleSyntax` are on: type-only imports use `import type`, and relative imports end in `.js`.
- **SVG safety.** Guest URLs are escaped and id prefixes are encoded. `decorate` strings are raw SVG from trusted callers.

## Adding or changing a form

1. Write `src/forms/<id>.form.ts` exporting `form: FormModule`. The id is plain lowercase ASCII and the display name is French.
2. List it by hand in **both** `src/registry.ts` and `src/load-form.ts`. Both lists are deliberate, since discovery would not load the same way in a browser, a bundler and Node.
3. Document every variant key; `resolveVariant` refuses unknown keys and values out of range. Give the form at least one example, since the specimen gallery and tests draw from them.
4. Update the forms table in the README, including its count of calendar days.

## The calendar

- `src/calendar/names.ts` keeps Fabre d'Églantine's 360 day names with their articles as he printed them, then the complementary days. `gallery/english.ts` holds the English names in the same order, from Wikipedia's tables.
- `PLANTS` has one row for each of the 288 plant days and none for animal or tool days, which grow the day before's plant.
- Year XV and every fourth year after are sextile, with no exception for centuries. The README explains this rule.
- **Complementary days hold festivals.** `calendarDay` gives each of them the year's last plant, le marron (the plant 30 fructidor grows), and `festival`, the day's festival. Every day has a plant.

## Festivals

A festival does something to a plant: `growGarden({ …, festival })`, for any plant. Each lives in `src/festivals/<id>.ts` and exports `festival: FestivalModule`. Like the forms, festivals are listed by hand twice: in `registry.ts` for the main entry, which takes their ids, and in `load-festival.ts` for the light entry, which takes their modules, so a light page carries no festival it does not hold. Their ideas came from Camille. A festival builds its garden through the context it is given, never by importing the growth loop:

- `context.grow()` grows the plant's ordinary garden. It can grow it in the column alone (`page: false`), from another form, or with main stems laid by `mains`.
- `context.compose(items)` makes a garden from items laid out in the column. It numbers them, ripens them as the loop does, and sets the column on the page.

`test/festivals.test.ts` holds every festival to the garden invariants, on a grain, a flower, a climber, a footed plant and a stemless one. Only Opinion's marks (layer 7 and up) may write over a page's text. A form can offer the festivals its `husk` and `kernel`, which only `arbre-fruitier`'s chestnut draws so far. Code shared by a form and a festival but not by most forms, such as the oak leaf in `src/leaves.ts`, stays out of `kit.ts`, which every form loads and the toolkit exports.

## Guest figures

An animal day's figure **visits**: it is 1.4 cm tall, stands beside a main stem facing the plant, and arrives at `t = 0.2`. A tool day's figure **rests**: it is 3.2 cm long and lies near the foot from the start of the day, among the stems, where the leaves grow round it. Both are drawn as masks, so they take the manner's ink and the palette.

To add one:

1. Cut it from a public-domain engraving of the period. Make an ink mask with opaque ink and transparent paper, facing right, reduced to 240 px on its long side.
2. Name the file `figures/<name>.png`, where `<name>` is what `figureName` gives for the day: no article or accents, œ spelled `oe`, words joined by hyphens.
3. Add its `kind` and `aspect` (width over height) to `FIGURES` in `src/calendar/figures.ts`.
4. Add its row to `figures/PROVENANCE.md`, with the work, plate, scan and rights, and take the day out of "Days without a figure".
5. Update the list of missing figures in `test/calendar.test.ts`, and the figure counts in the README's History section.

Scans from the Bibliothèque interuniversitaire de santé are under the Etalab Open Licence, which requires attribution. Record their terms exactly in `figures/PROVENANCE.md`.

## Palettes

Each palette has a light reading and a dark one. Every wash stands 6:1 to 10:1 from its paper and every line at least 7:1, and a test checks both. The historical names and periods are part of the brand, so keep them when retuning a colour.

## The playground

The playground is a Vite site with `base: "./"`, so it works from a subdirectory: it is hosted at cadaeic.space/eglantine/. Follow `DESIGN.md`. The palette colours the whole page, and the interface has no colours of its own. Chosen words are underlined, not only coloured. Touch targets are at least 44 px. Reduced motion skips the opening animation.

## Writing

- **Prose** (README, docs, comments, test names) is plain and concrete, in British spelling (colour, licence, centimetre). It names plants and days in French with their accents, and keeps ids and file names in ASCII.
- **Comments** are full sentences that say what a thing is and why it is so.
- **Test names** are sentences about behaviour, such as "never takes back what it has shown as the day goes on or fills".
- **Commit subjects** are sentences in the same voice, saying what the change does for the garden or its reader. One example is "Gardens grow round the text of a page, as florilegium's do". The body says what changed and what stayed the same. Recent history uses no conventional-commit prefixes.

## The package

`exports` names the entries `.`, `./lite`, `./calendar`, `./toolkit`, `./palettes.css` and `./figures/*`. `files` ships `dist`, `figures` and the florilegium licence. `prepare` builds, so installing from GitHub works. A new entry point needs a line in `exports`. Keep the package free of runtime dependencies.
