# Églantine

Églantine (`eglantine-marginalia`) grows procedural plants for the margin of a page and draws them as SVG in the manner of eighteenth-century French engraving. A garden grows from a seed and a plant form, and it can be drawn at any moment of a day: stems lengthen, buds open, flowers go to seed and leaves fill in. A calendar module gives each day of the year a plant, after the day names of the French Republican calendar.

![Gardens in the two manners](docs/showcase.webp)

The library is TypeScript with no runtime dependencies. Growing and rendering use no DOM, so a garden can be drawn in a browser, a web worker or Node.

## Usage

```ts
import { growGarden, renderGarden } from "eglantine-marginalia";

const garden = growGarden({ seed: 1793, form: "capitule", variant: { rays: 21 } });
const svg = renderGarden(garden, { t: 0.6, fullness: 0.4 }, { manner: "taille-douce", id: "margin", scale: 36 });
```

`growGarden` lays the whole garden out once from its seed. `renderGarden` draws it at a moment and returns an SVG string. The garden fills a column 6 cm wide and 22 cm tall, and `scale` sets the pixels per centimetre. `id` prefixes the SVG's internal ids, so several gardens can share a page. The renderer encodes characters other than ASCII letters, digits and hyphens in internal SVG ids.

A moment has two values between 0 and 1:

- `t` is the time of day. It brings the stems, then the buds, which open and, near the end of the day, go to seed.
- `fullness` measures how full the day is, in whatever sense the page chooses: words written, pages read, tasks done. It brings the leaves, the mycelium of the fungi and the crystals in the rock. A garden at fullness 0 already shows 30% of its leaves, and a quiet day keeps the same flowers as a full one.

Neither value takes back what it has shown: a leaf or bloom present at some moment stays present at every later time and greater fullness.

## Manners

`taille-douce` is the copperplate: paper-white forms with a fine outline, shade cut as hatching and stems in solid ink. `lavis` is the wash: transparent layers of bistre, darker in the shade and pooled at the edges, with veins lifted out in paper.

The SVG refers to four inks through CSS custom properties, each with a fallback colour: `--eglantine-ink`, `--eglantine-paper`, `--eglantine-accent` and `--eglantine-wash`. A page's stylesheet can set them to match a theme. A garden shown as an image or saved as a file has no stylesheet, so `withInks(svg, { ink: "#1b1b1b" })` writes the colours into the SVG and keeps the fallbacks for the inks left out.

A theme sets the four inks with a few needs in mind. The forms are cut out of `--eglantine-paper`, so the paper has to match the surface the garden lies on: in a sidebar of another colour, set the paper to that colour, or the forms show as patches of the page. The lavis manner lays the wash in layers of 14% to 38% opacity, and the default bistre stands 8.4:1 in contrast from the default cream; a much lighter wash fades out. The accent marks pistils that sit on washed petals, so it should stand apart from the wash.

## Palettes

```ts
import "eglantine-marginalia/palettes.css";
// <aside data-eglantine-palette="madder">…</aside> tints every garden inside it.

import { paletteInks, withInks } from "eglantine-marginalia";
const print = withInks(svg, paletteInks("iron-gall", "dark"));
```

Eight palettes come with the library, after colours inspired by eighteenth-century France. Each has a light reading, by daylight on a pale page, and a dark one, by candlelight on a dark page. In the stylesheet, `data-eglantine-palette="madder"` follows the system's colour scheme, and `madder-light` or `madder-dark` fixes a reading. Every wash stands between 6:1 and 10:1 from its paper and every line at least 7:1.

| Palette | Name | Period | Wash and accent |
|---|---|---|---|
| `puce` | Couleur de puce | 1775 | flea's-back brown, with the rose of cuisse de nymphe émue |
| `olive` | Boue de Paris | 1775 to 1781 | toad green, with Dutch-cheese orange |
| `cockade` | Palais-Royal | 12 July 1789 | cockade green, with the red of Paris |
| `iron-gall` | Le Vieux Cordelier | winter 1793 to 1794 | aged iron-gall ink, with sealing-wax red |
| `pansy` | Germinal an II | spring 1794 | pansy violet, with jonquil yellow |
| `porcelain` | Fonds de Sèvres | 1752 to 1763 | Sèvres blue, with gilding |
| `madder` | Toile de Jouy | 1770 to the 1790s | madder, with pencilled indigo |
| `red-chalk` | Aux trois crayons | about 1715 to 1720 | bistre on chamois, with red chalk |

A wash in one brown, madder or blue suits every day. The green washes of `olive` and `cockade` suit flowers but turn rock sections and dead wood green as well.

## The calendar

```ts
import { calendarDay, figureURL } from "eglantine-marginalia/calendar";
import { growGarden, renderGarden } from "eglantine-marginalia";

const day = calendarDay("2026-10-31");
// day.dateline: "8 brumaire an CCXXXV"; day.name: "la scorsonère"
if (day.plant) {
  const garden = growGarden({ seed: 1793, form: day.plant.form, variant: day.plant.variant, ...(day.guest ? { guest: day.guest } : {}) });
  const svg = renderGarden(garden, { t: 0.5, fullness: 0.5 }, {
    manner: "lavis", id: "today", scale: 36, ...(day.guest ? { guestFigure: figureURL(day.guest.figure).href } : {}),
  });
}
```

The French Republican calendar was in use from 1793 to 1805. It divides the year into twelve months of thirty days, followed by five complementary days, or six in a sextile year. In his report to the National Convention in 1793, Fabre d'Églantine gave each day of a month a name: a plant for most days, an animal for every fifth day and a tool for every tenth. The library takes the names as they were printed and gives each of the 288 plant days a form and a variant (see `PLANTS`). On an animal or tool day the garden grows the previous day's plant, and an engraved figure of the animal visits it or the tool lies at rest at its foot. The complementary days have no plant.

Guest sizes are upper limits. The layout scales wide figures proportionally to fit the column, including their tilt.

The Republic declared years III, VII and XI sextile before it abolished the calendar, and later readings disagree on the years after. `republicanDate` keeps the four-year rhythm those years set: year XV and every fourth year after are sextile, with no exception for centuries. By this rule 31 October 2026 is 8 brumaire an CCXXXV, a day later than a reading that follows the autumn equinox.

The figures are ink masks cut from eighteenth-century engravings, in public-domain scans by the Smithsonian Libraries, the Bibliothèque interuniversitaire de santé in Paris, the University of Seville, Naturalis and other libraries, served through the Internet Archive. [figures/PROVENANCE.md](figures/PROVENANCE.md) lists the work, plate and scan for each of the 67 figures. Five days have no figure: le cordeau, le bœuf, la vache, la houlette and le traîneau. On those days the garden grows without a guest.

## Forms

A form describes what a plant is made of and how it stands: its stems, leaves, bloom and what the bloom becomes. A variant tunes a form to a particular plant, such as a pear rather than a fig. Each form documents its variant keys, and `resolveVariant` rejects unknown keys and values out of range.

| Form | Name | Draws | Calendar days |
|---|---|---|---|
| `arbre-fruitier` | arbre fruitier | trees, shrubs and fruiting shoots, shown by fruit that buds, swells and ripens | 39 |
| `capitule` | capitule | composite flower heads, going to a clock of plumed seeds or a dry head | 17 |
| `conifere` | conifère | needled or scaled sprays and their cones, berry-like cones or arils | 8 |
| `cryptogame` | cryptogame | fungi from soil and dead wood over their mycelium, mosses, lichens, ferns and horsetails | 10 |
| `epi-aromatique` | épi aromatique | upright stems of small flowers in spikes, whorls, heads or panicles | 45 |
| `epi-graminee` | épi de graminée | grasses and grains under their ears and panicles | 15 |
| `feuillage` | feuillage | plants shown by their leaves, with catkins, nuts or berries | 36 |
| `grimpante` | grimpante | climbers held by tendrils, twining stems or rootlets | 15 |
| `hiver` | hiver | winter: rocks, earths and metals in an engraved geological section with their period chemical signs, under bare twigs | 26 |
| `lis-bulbe` | lis et bulbe | scape-and-strap plants with six tepals over a bulb or corm | 18 |
| `ombelle-corymbe` | ombelle et corymbe | flat-topped clusters: corymbs and compound umbels | 17 |
| `racine-tubercule` | racine et tubercule | plants known by a root or tuber at the foot of the column, some of them very long | 18 |
| `rosacee-coupe` | rosacée en coupe | radial and cupped flowers in perspective, going to hips, haws and capsules | 24 |

The forms carry French names, like the calendar's days, and plain lowercase ASCII ids. `npm run gallery` serves a page that shows every form's examples at bloom and at seed, with their flowers and leaves drawn large, the calendar's garden for any date, and every palette.

## Extending

`growGarden` also accepts a `FormModule` object in place of a registered id. The `eglantine-marginalia/toolkit` entry point exports what the bundled forms are built with: plane geometry, seeded randomness, engraved bodies and the shared leaves and flowers. A form can grow out of a foot, such as a root, a stump or a bed of strata drawn at the column's base, and can ink its stems as threads or bark (see `Foot` and `StemInk` in `src/form.ts`).

`renderGarden` takes a `decorate` option that lays further marks on a garden. An inlay lies at a numbered layer among the plant's parts, inside the wash, and the `under` and `over` marks lie beneath and above the whole garden. Decoration strings are raw SVG and must come from trusted sources.

The forms are drawn for the 6 × 22 cm column. Their sizes are in centimetres and a foot is placed within that column, so a much narrower or shorter column crowds the plants. A larger margin on screen comes from a larger `scale`, not a larger column.

## Development

```sh
npm install
npm test          # the garden invariants over every form's examples, and the calendar
npm run typecheck
npm run gallery   # http://localhost:5210
npm run build     # dist/
```

## Credits

The growth loop follows the grown composition of Kevin Raymond's [florilegium](https://github.com/kevinraymond/florilegium), a LuaLaTeX package under the MIT licence, whose notice is in [florilegium-LICENSE.txt](florilegium-LICENSE.txt). Florilegium in turn follows Michael T. Wong, Douglas E. Zongker and David H. Salesin, "Computer-Generated Floral Ornament", SIGGRAPH 1998.

The palettes were resolved after the method of [madoromi](https://github.com/the-moonwitch/madoromi), which reads historical inks at the lightness each role needs; they share no code or colours with it. Several colour names come from the children's trail [Les couleurs au 18e siècle](https://lesbateliers.namur.be/documentation-et-presse/publications/carnets-pedagogiques/les-couleurs-du-18e-siecle) (Musée Les Bateliers, Namur, 2023).

Plant-only SVGs require no attribution to the scanning libraries. Six guest figures use scans by the Bibliothèque interuniversitaire de santé, Paris under the Etalab Open Licence. The licence requires attribution to the library when those images are reused or redistributed, including within the full package.

## Licence

The code is licensed under [MIT](LICENSE). Copies or substantial portions of the code must retain its copyright and licence notices.

The guest figures derive from public-domain engravings. [Figure provenance](figures/PROVENANCE.md) records their scan terms and source credits.
