// Generates a full art set for each AI style with Meta Muse Image, for the live style switcher (/styles).
//   assets/styles/<style>/characters/<id>.jpg         portrait (head and shoulders, mouth closed)
//   assets/styles/<style>/characters/<id>-speak.jpg   the same portrait, mouth open (Muse image edit), for talking
//   assets/styles/<style>/scenes/<sceneId>.jpg        one per episode, 16:9
//   assets/styles/<style>/illustrations/<id>.jpg      story pictures and emblems, 1:1
//   assets/styles/<style>/manifest.json               what exists (read by /styles and the stage)
// Resumable: existing files are skipped. Images are shrunk to JPEG with macOS `sips`.
// Run: node --env-file=.env assets/tools/style-sets.mjs [styleId ...]      (needs MODEL_API_KEY; $0.01 per image)
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { STYLES } from "./style-defs.mjs";

const KEY = process.env.MODEL_API_KEY || process.env.MUSE_API_KEY;
const API = process.env.MUSE_API_URL ?? "https://api.meta.ai/v1";
const MODEL = process.env.MUSE_MODEL ?? "muse-image-1.0";
const CONCURRENCY = Number(process.env.MUSE_CONCURRENCY ?? 8);
const root = new URL("../styles/", import.meta.url).pathname;
const proposals = new URL("../style-proposals/", import.meta.url).pathname;
const read = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));

const NO_TEXT = "No text, no letters, no watermark, no signature.";
const PORTRAIT = "Head-and-shoulders portrait facing the viewer, centred, the figure fills the frame, mouth gently closed, plain simple background.";
export const CHARACTERS = {
  athena: "The goddess Athena from Homer's Odyssey: calm, wise and warm expression; a bronze Corinthian helmet pushed up on her head with a tall horsehair crest; an aegis over her shoulders with a small Gorgon emblem; a spear resting against her shoulder.",
  odysseus: "Odysseus, the hero of Homer's Odyssey: a weathered, clever sailor-king in his forties with a short curly dark beard and knowing eyes; a conical felt sailor's cap; a cloak pinned at the shoulder with a gold brooch; an oar over his shoulder.",
  poseidon: "Poseidon, god of the sea, from Homer's Odyssey: proud, stern and powerful; long flowing dark hair and a great curling beard with a hint of sea-green; a crown of golden spikes; a golden trident beside him.",
  circe: "Circe, the enchantress of Aeaea from Homer's Odyssey: sly, perceptive and amused; very long dark hair; a golden diadem; gold earrings; holding a golden drinking cup in one hand and a slender golden wand in the other.",
};
const SPEAK_EDIT = "Keep this image exactly the same: the same person, face, pose, lighting, colours, framing and background. Change only the mouth: open it naturally mid-word, as if speaking, with the teeth just visible.";

export const SCENES = {
  telemachus: "In the great hall of Odysseus' palace on Ithaca, rowdy suitors feast at long tables while young Telemachus stands up with a spear, finding his courage; an owl watches from the rafters.",
  calypso: "On Calypso's lush island, Odysseus sits alone on the shore staring out to sea, longing for home; a cave with vines behind him, and the timbers of a raft on the sand.",
  phaeacians: "In the torch-lit hall of the Phaeacian king, a blind bard sings with a lyre while Odysseus covers his face and weeps; nobles at a feast.",
  "lotus-eaters": "On a sunny shore covered with huge lotus flowers, Odysseus' sailors lie dreamy and smiling, while Odysseus drags one of them back toward the ships.",
  cyclops: "Inside a vast cave, the one-eyed giant Polyphemus sits among his sheep; Odysseus and his men hide in the shadows holding a long sharpened olive stake.",
  aeolus: "Odysseus' ship tossed in a sudden storm, a torn ox-hide bag bursting open with swirling winds, Ithaca's coast fading on the horizon.",
  circe: "In Circe's marble hall, the enchantress raises a golden cup and wand as Odysseus' men turn into pigs; Odysseus enters with sword drawn.",
  underworld: "Odysseus in the gloomy land of the dead beside a trench, pale ghosts crowding toward him, his mother's ghost reaching out, fields of asphodel.",
  sirens: "Odysseus tied to the mast of a black Greek ship with a painted eye on the prow, his crew rowing with wax in their ears, two Sirens (bird bodies with women's heads) singing on rocky islets scattered with bones.",
  "scylla-charybdis": "A Greek ship racing through a narrow strait between the six-headed monster Scylla on a cliff and the swirling whirlpool Charybdis.",
  "helios-cattle": "On the island of the Sun, starving sailors drive away the Sun-god's sacred golden cattle under a blazing sun as storm clouds gather.",
  "return-to-ithaca": "In his palace, Odysseus disguised as a ragged beggar effortlessly strings his great bow before the astonished suitors, a row of twelve axes behind him; Penelope watches from the stairs.",
};

const illustrations = read("../../story/data/illustrations.json");

function jobsFor(style) {
  const jobs = [];
  for (const [id, who] of Object.entries(CHARACTERS)) {
    jobs.push({ style, out: `characters/${id}.jpg`, max: 960, kind: "generate", aspect: "3:4", prompt: `${who} ${PORTRAIT} ${NO_TEXT}`, reuse: id === "athena" ? `${proposals}${style.id}/athena.png` : null });
    jobs.push({ style, out: `characters/${id}-speak.jpg`, max: 960, kind: "edit", from: `characters/${id}.jpg`, prompt: SPEAK_EDIT });
  }
  for (const [id, what] of Object.entries(SCENES))
    jobs.push({ style, out: `scenes/${id}.jpg`, max: 1280, kind: "generate", aspect: "16:9", prompt: `${what} Wide cinematic composition. ${NO_TEXT}`, reuse: id === "sirens" ? `${proposals}${style.id}/sirens.png` : null });
  for (const i of illustrations)
    jobs.push({ style, out: `illustrations/${i.id}.jpg`, max: 720, kind: "generate", aspect: "1:1", prompt: `${i.description}: a single object or figure, centred and isolated on a plain, simple background, like an emblem. ${NO_TEXT}` });
  return jobs;
}

const SIZE = { "3:4": "1536x2048", "16:9": "1792x1008", "1:1": "1024x1024" };

async function call(path, body) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      method: "POST",
      headers: { authorization: `Bearer ${KEY}`, "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, n: 1, response_format: "b64_json", output_format: "jpeg", ...body }),
    });
    if (res.ok) {
      const b64 = (await res.json()).data?.[0]?.b64_json;
      if (!b64) throw new Error("no image in response");
      return Buffer.from(b64, "base64");
    }
    const text = await res.text();
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      const wait = Number(res.headers.get("retry-after")) * 1000 || 2000 * 2 ** attempt + Math.random() * 1000;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`${res.status}: ${text.slice(0, 240)}`);
  }
}

/** Shrinks to `max` px on the long side as JPEG (quality 82) with macOS sips. */
function shrink(src, dest, max) {
  execFileSync("sips", ["-s", "format", "jpeg", "-s", "formatOptions", "82", "-Z", String(max), src, "--out", dest], { stdio: "ignore" });
}

async function run(job) {
  const dir = `${root}${job.style.id}/`;
  const dest = dir + job.out;
  if (existsSync(dest)) return "skip";
  mkdirSync(dest.slice(0, dest.lastIndexOf("/")), { recursive: true });
  const tmp = `${dest}.tmp.jpg`;
  if (job.reuse && existsSync(job.reuse)) {
    shrink(job.reuse, dest, job.max);
    return "reused";
  }
  let img;
  if (job.kind === "edit") {
    const from = dir + job.from;
    if (!existsSync(from)) throw new Error(`needs ${job.from} first`);
    img = await call("/images/edits", { prompt: job.prompt, images: [{ image_url: `data:image/jpeg;base64,${readFileSync(from).toString("base64")}` }], size: SIZE["3:4"] });
  } else {
    img = await call("/images/generations", { prompt: `${job.prompt}\n\nStyle: ${job.style.prompt}`, size: SIZE[job.aspect] });
  }
  writeFileSync(tmp, img);
  shrink(tmp, dest, job.max);
  rmSync(tmp, { force: true });
  return "made";
}

function writeManifest(style) {
  const dir = `${root}${style.id}/`;
  const list = (sub) => (existsSync(dir + sub) ? readdirSync(dir + sub).filter((f) => f.endsWith(".jpg") && !f.includes(".tmp")).map((f) => f.slice(0, -4)) : []);
  const prev = existsSync(dir + "manifest.json") ? JSON.parse(readFileSync(dir + "manifest.json", "utf8")) : {};
  const manifest = {
    ...prev,
    id: style.id, label: style.label, blurb: style.blurb,
    characters: list("characters"), scenes: list("scenes"), illustrations: list("illustrations"),
    total: jobsFor(style).length, updatedAt: new Date().toISOString(),
  };
  manifest.ready = manifest.characters.length + manifest.scenes.length + manifest.illustrations.length;
  mkdirSync(dir, { recursive: true });
  writeFileSync(dir + "manifest.json", JSON.stringify(manifest, null, 2));
  return manifest;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!KEY) { console.error("Set MODEL_API_KEY in .env"); process.exit(2); }
  const wanted = process.argv.slice(2);
  const styles = STYLES.filter((s) => !wanted.length || wanted.includes(s.id));
  // Portraits must exist before their speaking edits, so generations run first, then edits.
  const all = styles.flatMap(jobsFor);
  const phases = [all.filter((j) => j.kind === "generate"), all.filter((j) => j.kind === "edit")];
  let made = 0, failed = 0;
  for (const jobs of phases) {
    let next = 0;
    await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
      while (next < jobs.length) {
        const job = jobs[next++];
        try {
          const r = await run(job);
          if (r !== "skip") { made++; console.log(`[sets] ${job.style.id}/${job.out} ${r}`); }
        } catch (err) {
          failed++;
          console.error(`[sets] ${job.style.id}/${job.out} FAILED: ${String(err.message ?? err).slice(0, 200)}`);
        }
      }
    }));
    styles.forEach(writeManifest);
  }
  for (const s of styles) { const m = writeManifest(s); console.log(`[sets] ${s.id}: ${m.ready}/${m.total} images ready`); }
  console.log(`[sets] done: ${made} new, ${failed} failed`);
}
