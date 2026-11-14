Owned by Role 4. Served by the stage at `/assets/...` (via the `stage/public/assets` symlink).

## Files (other roles depend on these names)
- `characters/<id>/body.png`, `mouth-0.png` .. `mouth-3.png` (closed → wide) and `blink.png`, all 720x1000 with transparent
  backgrounds so they stack. Ids: `athena`, `odysseus`, `poseidon`, `circe`.
- `scenes/<sceneId>.png`, 1280x720, one per episode in `story/data/episodes.json`: `telemachus`, `calypso`,
  `phaeacians`, `lotus-eaters`, `cyclops`, `aeolus`, `circe`, `underworld`, `sirens`, `scylla-charybdis`,
  `helios-cattle`, `return-to-ithaca`.
- `map/base.png` (1280x720), `map/locations.json` (`x`, `y` in percent of the map) and `map/route.json` (voyage order, for
  the dotted route from Troy).

## Art style
Greek red-figure vase painting: terracotta figures (`#c8693a`) with black outlines on black glaze (`#17110d`), cream
(`#f1dfc0`) and gold (`#e8c15a`) details, meander borders top and bottom. Characters are frontal busts on a transparent
background.

Every image is drawn as SVG in [tools/art.mjs](tools/art.mjs) and rendered to PNG by
[tools/generate.mjs](tools/generate.mjs), so the style stays consistent and anyone can edit and re-render:

```bash
npx playwright install chromium   # once
npm run art -w stage              # rewrites every PNG in assets/
```

If you replace a scene with AI-generated art, use this prompt prefix to keep the style:
"Ancient Greek red-figure vase painting, terracotta figures with fine black outlines on a black glaze background,
cream and gold accents, Greek key meander border top and bottom, flat, no text, 16:9."
