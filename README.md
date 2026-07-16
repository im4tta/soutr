# Soutr (សូត្រ) 🧵

*Soutr* is the Khmer word for silk. This is a real-time, physics-based
fabric preview you can drop into any fabric or clothing shop's website.
Built with plain WebGL and vanilla JS — no build step, no framework, no
dependencies. Open `index.html` and it runs.

The homepage greets customers with **several live, independently-moving
pieces at once** — clothes and a doorway wind chime side by side, each its
own small WebGL scene. Grab and drag any card right there to feel how it
moves, or tap **Open** to jump into the full studio for that piece.

In the full studio, customers can **grab the cloth (or chime) and drag it**
to feel how it drapes or sways, switch between hang styles — curtain,
draped swatch, and eight Khmer-style pieces: **krama** scarf, **sampot**
wrap, **chong kraben**, **sbai** shoulder cloth, **everyday sarong**,
**royal chong kraben**, **bridal sbai**, and a **doorway wind chime** —
try colours, wood tones, and weaves, and the whole UI works in **English
or Khmer**.

## Features

- **Verlet cloth physics** — stretch, shear, and bend constraints, so folds
  form and settle the way real fabric does. The same solver drives the wind
  chime's individual strands, just pinned and shaped differently.
- **Homepage gallery of several live previews at once** — not a single
  static hero shot: multiple small canvases animate independently on load,
  and each is directly draggable, not just decorative.
- **10 hang styles**, 8 of them Khmer clothing: Curtain, Draped swatch,
  Krama scarf, Sampot wrap, Chong kraben, Sbai, **Everyday sarong**,
  **Royal chong kraben**, **Bridal sbai**, and a **doorway wind chime**.
- **Khmer-style doorway wind chime** — modelled as several independent
  hanging strands (not a solid sheet), each a string of small carved
  wood/bamboo links with a Khmer roundel accent bead and a frayed cord
  tassel, swaying independently in the breeze the way a real beaded or
  wooden doorway curtain does. Has its own wood-tone palette (rattan,
  bamboo, rosewood, ebony, gilded gold) instead of fabric colours.
- **10 fabric colours + 5 wind-chime wood tones, plus a custom colour
  picker** for either.
- **9 weave/pattern presets**, including five Khmer-inspired motifs:
  - `Krama check` — the tight two-tone gingham of an everyday krama
  - `Hol ikat` — soft-edged diamond banding evoking Khmer ikat silk
  - `Pidan band` — repeating temple-motif banding evoking ceremonial silk
  - `Phamuong stripe` — fine, dense multi-tone stripe evoking phamuong silk
  - `Chorabap gold` — dense gold-banded medallion weave evoking royal
    ceremonial chorabap silk

  These are stylised, real-time approximations for previewing colour and
  drape — not reproductions of specific registered textile designs.
- **"Shop the look" sample gallery** — a real-store-style grid of 15 curated
  pieces (colour/material + pattern + hang style + price), so customers can
  browse several looks and load any one into the live preview with a tap.
- **Fabric feel controls** — stiffness, wind strength, gravity/weight, and
  overall size, so a shop can match the sim to how heavy their actual fabric
  (or how light their wind chime) is.
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
├── index.html          # homepage gallery markup + stage markup + all UI controls
├── css/
│   └── style.css        # all styling
├── js/
│   ├── i18n.js           # EN / KM string tables + language switching
│   ├── textures.js        # procedural fabric + wind-chime texture generator
│   ├── cloth.js             # Verlet cloth physics (rendering-agnostic)
│   ├── scene.js               # reusable WebGL scene: cloth/chime + drag + render loop
│   └── app.js                   # builds the homepage gallery + stage, wires up controls
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
  combination and call `scene.setHangStyle()` / `scene.setColor()` /
  `scene.setPattern()` on a `FabricScene` instance (see `scene.js`) from
  your own product-page code.
- **More languages:** add another block to `I18N` in `i18n.js` and a button
  in the `#langSwitch` element in `index.html`.
- **More hang styles / more Khmer clothes:** add an entry to `HANG_STYLES`
  in `scene.js` (width, height, offset, and a `pinMode` of `top-row`,
  `corners`, or `center-pair`) and a button in the hang-style section of
  `index.html`. Set `chime:true` plus `strands`/`strandWidth`/`spread`
  instead of `width`/`pinMode` to get a wind-chime-style independent-strand
  layout rather than a solid cloth panel.
- **More homepage cards:** add an entry to `HOME_ITEMS` in `app.js`.

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
