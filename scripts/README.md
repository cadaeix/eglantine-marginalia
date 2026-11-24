# Scripts

- `palettes-css.mjs` writes `dist/palettes.css` from the palettes; `npm run build` runs it.
- `sweep.ts` grows every calendar plant and every form example across sizes, layouts and festivals, draws each at two moments, and lists every garden that throws. It exits with 1 if any did.

## The sweep

```sh
npm run sweep                                    # the column at 4, 8, 14, 22 and 30 cm
npm run sweep -- --layout page,hanging           # several layouts in turn
npm run sweep -- --layout bandeau --heights 3,6  # a band at heights other than its own
npm run sweep -- --widths 2,12 --heights 22      # narrow and wide columns
npm run sweep -- --festival genie,none           # with a festival, and without
npm run sweep -- --form racine-tubercule         # one form's calendar days and examples
```

`--layout` takes `column`, `page`, `hanging`, `bandeau` and `cul-de-lampe`. A band grows at its own size, and a column at 6 cm wide, unless `--heights` and `--widths` say otherwise. `--seeds` defaults to `1,1793`. Each list is comma-separated.

The default run grows about 3,800 gardens and takes about three minutes. Each further layout, festival, size or seed adds as many again.
