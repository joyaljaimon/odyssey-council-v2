// Finds the mouth in each AI-style portrait by comparing it with its "-speak" version: the area that changed most
// (inside the face region) is the mouth. Saves { x, y } (percent) into assets/styles/<style>/manifest.json -> mouth,
// which the stage uses to fade the speaking image in over just the lips.
// Run after style-sets.mjs: node assets/tools/style-mouths.mjs
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";

const root = new URL("../styles/", import.meta.url).pathname;
const styles = existsSync(root) ? readdirSync(root).filter((d) => existsSync(`${root}${d}/manifest.json`)) : [];
const browser = await chromium.launch();
const page = await browser.newPage();

for (const style of styles) {
  const manifestFile = `${root}${style}/manifest.json`;
  const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
  manifest.mouth ??= {};
  for (const id of manifest.characters.filter((c) => !c.endsWith("-speak") && manifest.characters.includes(`${c}-speak`))) {
    const a = `data:image/jpeg;base64,${readFileSync(`${root}${style}/characters/${id}.jpg`).toString("base64")}`;
    const b = `data:image/jpeg;base64,${readFileSync(`${root}${style}/characters/${id}-speak.jpg`).toString("base64")}`;
    const spot = await page.evaluate(async ([a, b]) => {
      const load = (src) => new Promise((ok, fail) => { const i = new Image(); i.onload = () => ok(i); i.onerror = fail; i.src = src; });
      const [ia, ib] = await Promise.all([load(a), load(b)]);
      const W = 90, H = 120; // compare on a coarse grid; both images are drawn to the same size
      const px = (img) => { const c = document.createElement("canvas"); c.width = W; c.height = H; const g = c.getContext("2d"); g.drawImage(img, 0, 0, W, H); return g.getImageData(0, 0, W, H).data; };
      const da = px(ia), db = px(ib);
      const diff = new Float32Array(W * H);
      for (let i = 0; i < W * H; i++) diff[i] = Math.abs(da[i * 4] - db[i * 4]) + Math.abs(da[i * 4 + 1] - db[i * 4 + 1]) + Math.abs(da[i * 4 + 2] - db[i * 4 + 2]);
      // Strongest 5x5 window inside the plausible face area (middle columns, upper-middle rows).
      let best = { s: -1, x: W / 2, y: H * 0.6 };
      for (let y = Math.round(H * 0.25); y < Math.round(H * 0.8); y++)
        for (let x = Math.round(W * 0.25); x < Math.round(W * 0.75); x++) {
          let s = 0;
          for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) s += diff[(y + dy) * W + (x + dx)] ?? 0;
          if (s > best.s) best = { s, x, y };
        }
      return { x: Math.round((best.x / W) * 1000) / 10, y: Math.round((best.y / H) * 1000) / 10 };
    }, [a, b]);
    manifest.mouth[id] = spot;
    console.log(`[mouths] ${style}/${id}: mouth at ${spot.x}% , ${spot.y}%`);
  }
  writeFileSync(manifestFile, JSON.stringify(manifest, null, 2));
}
await browser.close();
