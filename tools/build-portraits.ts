// Paints a portrait for every Council member that lacks one, in the same classical-oil style as the originals,
// plus a "speaking" version (same image, mouth open) for the talking animation.
//   assets/portraits/<id>.jpg   assets/portraits/<id>-speak.jpg
// Uses Meta Muse Image (MODEL_API_KEY, about $0.01 an image). Resumable: existing files are skipped.
// Run: npm run portraits [-- id ...]
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { ROSTER } from "../src/roster.ts";

const KEY = process.env.MODEL_API_KEY;
const API = process.env.MUSE_API_URL ?? "https://api.meta.ai/v1";
const MODEL = process.env.MUSE_MODEL ?? "muse-image-1.0";
const dir = fileURLToPath(new URL("../assets/portraits/", import.meta.url));

const STYLE = "Classical oil painting in the style of an 18th-century European academic history painting: dramatic chiaroscuro, warm candlelit golds and deep shadows, visible brushwork, rich fabric and metal textures, museum quality.";
const PORTRAIT = "Head-and-shoulders portrait facing the viewer, centred, the figure fills the frame, mouth gently closed, plain dark background. No text, no letters, no watermark, no signature.";
const SPEAK = "Keep this image exactly the same: the same person, face, pose, lighting, colours, framing and background. Change only the mouth: open it naturally mid-word, as if speaking, with the teeth just visible.";

const LOOKS: Record<string, string> = {
  zeus: "Zeus, king of the Greek gods: majestic older man with a great white-grey beard and flowing hair, a golden laurel crown, a thunderbolt crackling in his raised hand, a rich purple and white robe.",
  hermes: "Hermes, messenger of the Greek gods: a youthful, sly, smiling young man with short curly hair, a winged petasos traveller's hat, a golden caduceus staff with two snakes.",
  penelope: "Penelope, queen of Ithaca from Homer's Odyssey: a dignified, intelligent woman in her late thirties with dark hair under a fine veil, a thoughtful guarded expression, standing before a loom with threads.",
  telemachus: "Telemachus, son of Odysseus: an earnest young man of about twenty with short dark curly hair and a first light beard, a simple tunic and cloak, holding a bronze spear, determined eyes.",
  calypso: "Calypso, the nymph of Ogygia from Homer's Odyssey: a beautiful, melancholy immortal woman with long auburn hair braided with flowers, a sea-blue gown, a wistful longing gaze, lush vines behind.",
  polyphemus: "Polyphemus the Cyclops from Homer's Odyssey: a huge, rough, shaggy giant shepherd with a single great eye in the centre of his forehead, wild tangled hair and beard, a sheepskin over his shoulders, a cave behind him.",
  tiresias: "Tiresias, the blind prophet in the Underworld from Homer's Odyssey: a gaunt, very old man with pale clouded blind eyes, a long thin white beard, a golden staff, ghostly pale light around him.",
  eurylochus: "Eurylochus, a weary Greek soldier and sailor from Homer's Odyssey: a hard, tired, weather-beaten man in his thirties with a short dark beard, a battered bronze cuirass, a defiant look.",
  antinous: "A proud, handsome young ancient Greek nobleman with oiled dark curls, a confident smirk, a rich embroidered crimson robe and a gold brooch.",
  eumaeus: "Eumaeus, the loyal old swineherd from Homer's Odyssey: a kind, humble grey-haired man with a short white beard, a rough wool cloak, a gentle steady expression, a farmhouse behind.",
  nausicaa: "Nausicaa, the young Phaeacian princess from Homer's Odyssey: a bright, kind young woman with light brown hair tied with ribbons, a white linen dress, a warm curious smile, the seashore behind.",
  helios: "Helios, the Greek god of the Sun: a radiant, proud young god with golden hair and a crown of blazing sun rays, glowing golden skin, a fiery cloak.",
  circe: "Circe, the enchantress of Aeaea from Homer's Odyssey: sly, perceptive and amused; very long dark hair; a golden diadem; gold earrings; holding a golden drinking cup.",
};

async function call(path: string, body: Record<string, unknown>): Promise<Buffer> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, n: 1, response_format: "b64_json", output_format: "jpeg", ...body }),
    });
    if (res.ok) {
      const b64 = ((await res.json()) as { data?: { b64_json?: string }[] }).data?.[0]?.b64_json;
      if (!b64) throw new Error("no image in response");
      return Buffer.from(b64, "base64");
    }
    const text = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 5) { await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt)); continue; }
    throw new Error(`${res.status}: ${text.slice(0, 240)}`);
  }
}

const shrink = (src: string, dest: string) =>
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "82", "-Z", "960", src, "--out", dest], { stdio: "ignore" });

async function paint(id: string) {
  const base = `${dir}${id}.jpg`, speak = `${dir}${id}-speak.jpg`, tmp = `${dir}${id}.tmp.jpg`;
  if (!existsSync(base)) {
    writeFileSync(tmp, await call("/images/generations", { prompt: `${LOOKS[id]} ${PORTRAIT}\n\nStyle: ${STYLE}`, size: "1536x2048" }));
    shrink(tmp, base);
    console.log(`[portraits] ${id}.jpg`);
  }
  if (!existsSync(speak)) {
    writeFileSync(tmp, await call("/images/edits", { prompt: SPEAK, images: [{ image_url: `data:image/jpeg;base64,${readFileSync(base).toString("base64")}` }], size: "1536x2048" }));
    shrink(tmp, speak);
    console.log(`[portraits] ${id}-speak.jpg`);
  }
  rmSync(tmp, { force: true });
}

if (!KEY) { console.error("Set MODEL_API_KEY in .env"); process.exit(2); }
const wanted = process.argv.slice(2);
const todo = ROSTER.map((m) => m.id).filter((id) => (!wanted.length || wanted.includes(id)) && LOOKS[id] && (!existsSync(`${dir}${id}.jpg`) || !existsSync(`${dir}${id}-speak.jpg`)));
console.log(`[portraits] painting ${todo.length}: ${todo.join(", ")}`);
let failed = 0;
await Promise.all(todo.map((id) => paint(id).catch((err) => { failed++; console.error(`[portraits] ${id} FAILED: ${String(err.message ?? err).slice(0, 200)}`); })));
console.log(`[portraits] done, ${failed} failed`);
