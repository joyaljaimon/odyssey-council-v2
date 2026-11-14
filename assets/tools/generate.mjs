// Renders the art in ./art.mjs, ./characters.mjs and ./illustrations.mjs to PNG with headless Chromium.
// Run from the repo root (first time: npx playwright install chromium):
//   npm run art -w stage                          everything, characters in the saved style
//   npm run art -w stage -- --use storybook       switch the characters to another style (and save the choice)
//   npm run art -w stage -- --only characters     just one group: characters | scenes | illustrations | map
// Styles: see /characters on the stage, or STYLE_IDS in characters.mjs.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { mapSvg, scenes } from "./art.mjs";
import { DEFAULT_STYLE, STYLE_IDS, characterIds, characterLayers } from "./characters.mjs";
import { illustrations } from "./illustrations.mjs";

const out = (p) => new URL(`../${p}`, import.meta.url);
const arg = (name) => { const i = process.argv.indexOf(`--${name}`); return i === -1 ? undefined : process.argv[i + 1]; };
const styleFile = out("characters/style.json");
const saved = existsSync(styleFile) ? JSON.parse(readFileSync(styleFile, "utf8")).style : DEFAULT_STYLE;
const style = arg("use") ?? saved;
const only = arg("only");
if (!STYLE_IDS.includes(style)) { console.error(`Unknown style "${style}". Choose one of: ${STYLE_IDS.join(", ")}`); process.exit(2); }

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(svg, w, h, path, transparent) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  writeFileSync(out(path), await page.screenshot({ type: "png", omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } }));
}
const want = (group) => !only || only === group;

if (want("characters")) {
  for (const id of characterIds) {
    mkdirSync(out(`characters/${id}`), { recursive: true });
    for (const [file, svg] of Object.entries(characterLayers(id, style))) await render(svg, 720, 1000, `characters/${id}/${file}`, true);
  }
  writeFileSync(styleFile, JSON.stringify({ style }, null, 2) + "\n");
  console.log(`characters: ${characterIds.length} x ${Object.keys(characterLayers("athena")).length} layers in style "${style}"`);
}
if (want("scenes")) {
  mkdirSync(out("scenes"), { recursive: true });
  for (const [id, svg] of Object.entries(scenes)) await render(svg, 1280, 720, `scenes/${id}.png`, false);
  console.log(`scenes: ${Object.keys(scenes).length}`);
}
if (want("illustrations")) {
  mkdirSync(out("illustrations"), { recursive: true });
  for (const [id, svg] of Object.entries(illustrations)) await render(svg, 900, 900, `illustrations/${id}.png`, true);
  console.log(`illustrations: ${Object.keys(illustrations).length}`);
}
if (want("map")) { await render(mapSvg(), 1280, 720, "map/base.png", false); console.log("map: base.png"); }
await browser.close();
