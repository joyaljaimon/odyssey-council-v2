// Renders every SVG in ./art.mjs to PNG with headless Chromium (Playwright).
// Run from the repo root: npm run art -w stage   (first time: npx playwright install chromium)
import { mkdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { characterIds, characterLayers, scenes, mapSvg } from "./art.mjs";

const out = (p) => new URL(`../${p}`, import.meta.url);
const browser = await chromium.launch();
const page = await browser.newPage();

async function render(svg, w, h, path, transparent) {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  writeFileSync(out(path), await page.screenshot({ type: "png", omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } }));
  console.log("wrote", path);
}

for (const id of characterIds) {
  mkdirSync(out(`characters/${id}`), { recursive: true });
  for (const [file, svg] of Object.entries(characterLayers(id))) await render(svg, 720, 1000, `characters/${id}/${file}`, true);
}
mkdirSync(out("scenes"), { recursive: true });
for (const [id, svg] of Object.entries(scenes)) await render(svg, 1280, 720, `scenes/${id}.png`, false);
await render(mapSvg(), 1280, 720, "map/base.png", false);
await browser.close();
