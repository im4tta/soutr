# Soutr (សូត្រ) 🧵

*Soutr* is the Khmer word for silk. This is a real-time, physics-based
fabric preview you can drop into any fabric or clothing shop's website.
Built with plain WebGL and vanilla JS — no build step, no framework, no
dependencies. Open `index.html` and it runs.

Customers can **grab the cloth and drag it** to feel how it drapes, switch
between hang styles (curtain, draped swatch, and four Khmer styles — **krama**
scarf, **sampot** wrap, **chong kraben**, and **sbai** shoulder cloth), try
colours and weaves, and the whole UI works in **English or Khmer**.

## Features

- **Verlet cloth physics** — stretch, shear, and bend constraints, so folds
  form and settle the way real fabric does.
- **6 hang styles** — Curtain (rod-hung), Draped swatch (corner-clipped),
  Krama scarf (narrow, center-pinned), Sampot wrap (wide panel), Chong
  kraben (narrow wrap-around trouser cloth), Sbai (shoulder-draped cloth).
- **10 preset colours + a custom colour picker.**
- **8 weave/pattern presets**, including four Khmer-inspired motifs:
  - `Krama check` — the tight two-tone gingham of an everyday krama
  - `Hol ikat` — soft-edged diamond banding evoking Khmer ikat silk
  - `Pidan band` — repeating temple-motif banding evoking ceremonial silk
  - `Phamuong stripe` — fine, dense multi-tone stripe evoking phamuong silk

  These are stylised, real-time approximations for previewing colour and
  drape — not reproductions of specific registered textile designs.
- **"Shop the look" sample gallery** — a real-store-style grid of 10 curated
  pieces (colour + pattern + hang style + price), so customers can browse
  several looks and load any one into the live preview with a tap.
- **Fabric feel controls** — stiffness, wind strength, gravity/weight, and
  overall size, so a shop can match the sim to how heavy their actual fabric
  is (silk vs. cotton vs. curtain-weight, etc).
- **Light/dark studio backdrop.**
- **Product tag** — type an item name and price, show it as an overlay on
  the canvas, useful for a single-product landing page.
- **Save image** — exports the current canvas as a PNG a customer or staff
  member can share.
- **English / Khmer language toggle**, saved across visits.
- **Auto-hiding, tabbed control panel** — stays out of the way of the
  preview until you hover (or tap, on touch devices), and organizes
  controls into Shop / Style / Colour / Pattern / Feel / Scene / Tag tabs
  so nothing requires a long scroll. Fully responsive.

## Project structure

```
soutr/
├── index.html          # markup + all UI controls
├── css/
│   └── style.css        # all styling
├── js/
│   ├── i18n.js           # EN / KM string tables + language switching
│   ├── textures.js        # procedural fabric texture generator
│   ├── cloth.js            # Verlet cloth physics (rendering-agnostic)
│   └── app.js               # WebGL renderer + wires up all controls
├── README.md
└── LICENSE
```

## Running it

No build step needed:

```bash
# any static file server works, e.g.:
python3 -m http.server 8000
# then open http://localhost:8000
```

Or just double-click `index.html` — everything except the Khmer web font
(loaded from Google Fonts, with a system-font fallback) works fully offline.

## Adapting it for a real shop

- **Real fabric photos instead of procedural texture:** in `textures.js`,
  replace `drawFabricTexture()` with code that draws an `<img>` onto the
  canvas instead of the generated pattern — the rest of the pipeline (WebGL
  upload, lighting, drape) needs no changes.
- **Per-product presets:** map each SKU to a `{color, pattern, hangStyle}`
  combination and call `applyHangStyle()` / `updateTexture()` from your own
  product-page code.
- **More languages:** add another block to `I18N` in `i18n.js` and a button
  in the `#langSwitch` element in `index.html`.
- **More hang styles:** add an entry to `HANG_STYLES` in `app.js` (width,
  height, offset, and a `pinMode` of `top-row`, `corners`, or
  `center-pair`) and a button in the hang-style section of `index.html`.

## A note on the Khmer content

Translations and textile-pattern approximations were put together with care
but are not reviewed by a native-speaking linguist or a textile specialist.
If something reads awkwardly or a pattern doesn't feel right, corrections
via issue or pull request are very welcome — that's exactly the kind of
local knowledge this project should reflect.

## License

MIT — see [LICENSE](./LICENSE). Use it, fork it, put it in your shop.

---

*Soutr — សូត្រ — silk.*
