// "Teaches" the Council the whole Odyssey offline: reads Samuel Butler's full translation book by book and writes
// data/codex.md, a compact guide to all 24 books (events, people, ideas, and verbatim quotes). Every quote is checked
// against the text and dropped if it isn't word for word. The Council's prompt carries the codex on every turn,
// so it knows the whole book without sending 170k tokens each time.
// Run: npm run codex           (resumable: books already in data/codex-books/ are kept)
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { streamText } from "../src/gemini.ts";

type Passage = { id: string; book: number; para: number; text: string };
const data = (p: string) => fileURLToPath(new URL(`../data/${p}`, import.meta.url));
const passages = JSON.parse(readFileSync(data("passages.json"), "utf8")) as Passage[];
const titles = JSON.parse(readFileSync(data("book-titles.json"), "utf8")) as Record<string, string>;
const outDir = data("codex-books/");
mkdirSync(outDir, { recursive: true });
const MODELS = (process.env.CODEX_MODELS ?? "gemini-2.5-pro,gemini-3.1-pro-preview,gemini-2.5-flash,gemini-3.1-flash-lite,gemini-flash-lite-latest").split(",");

const SYSTEM = `You are building a study codex of Homer's Odyssey (Samuel Butler's 1900 prose translation, which uses Roman names: Ulysses = Odysseus, Minerva = Athena, Neptune = Poseidon, Jove = Zeus, Mercury = Hermes). You get one book's full text, each paragraph marked with its id [book.paragraph]. Write, in this exact format and nothing else:

## Book <n>: <short title>
<A dense summary of 150-220 words: every major event in order, who does what and why, where it happens. Use Greek names (Odysseus, Athena, Poseidon, Zeus, Hermes).>
People: <the characters who appear, each with a few words on what they do or want here>
Ideas: <2-4 themes this book shows (xenia, hubris, metis, nostos, loyalty, temptation, fate...)>
QUOTES:
- (<id>) "<a memorable sentence copied EXACTLY, word for word, from that paragraph, 8-35 words>"
(3 to 5 quotes; copy the characters exactly as written, including Roman names and punctuation)`;

const norm = (s: string) => s.toLowerCase().replace(/[‘’`]/g, "'").replace(/[“”]/g, '"').replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

function checkQuotes(md: string, book: number): { md: string; kept: number; dropped: number } {
  let kept = 0, dropped = 0;
  const lines = md.split("\n").filter((line) => {
    if (!/^\s*-\s*\(/.test(line)) return true;
    const m = /^\s*-\s*\(\[?(\d+\.\d+)\]?\)\s*["“](.+)["”]\s*$/.exec(line);
    if (!m) { dropped++; return false; }
    const p = passages.find((x) => x.id === m[1]) ?? passages.find((x) => x.book === book && norm(x.text).includes(norm(m[2])));
    const ok = !!p && norm(p.text).includes(norm(m[2]));
    ok ? kept++ : dropped++;
    return ok;
  });
  return { md: lines.join("\n").trim(), kept, dropped };
}

for (let book = 1; book <= 24; book++) {
  const file = `${outDir}${String(book).padStart(2, "0")}.md`;
  if (existsSync(file)) continue;
  const text = passages.filter((p) => p.book === book).map((p) => `[${p.id}] ${p.text}`).join("\n\n");
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      let md = "";
      for await (const d of streamText({ system: SYSTEM, models: MODELS, firstMs: 90_000, temperature: 0.3, maxTokens: 2000,
        contents: [{ role: "user", parts: [{ text: `BOOK ${book} (${titles[String(book)] ?? ""})\n\n${text}` }] }] })) md += d;
      const r = checkQuotes(md, book);
      if (!/^## Book/m.test(r.md) || r.md.length < 400) throw new Error("malformed answer");
      writeFileSync(file, r.md + "\n");
      console.log(`[codex] book ${book}: ${r.md.length} chars, ${r.kept} quotes kept, ${r.dropped} dropped`);
      break;
    } catch (err) {
      console.warn(`[codex] book ${book} attempt ${attempt} failed: ${(err as Error).message.slice(0, 120)}`);
      await new Promise((r) => setTimeout(r, 15_000 * attempt));
    }
  }
}

const books = readdirSync(outDir).filter((f) => f.endsWith(".md")).sort();
// Verify again on assembly, so hand edits and older runs can't let an unchecked quote through.
let kept = 0, dropped = 0;
const codex = books.map((f) => {
  const r = checkQuotes(readFileSync(outDir + f, "utf8").trim(), Number(f.slice(0, 2)));
  kept += r.kept; dropped += r.dropped;
  return r.md.replace(/\(\[(\d+\.\d+)\]\)/g, "($1)");
}).join("\n\n");
console.log(`[codex] quotes verified word for word: ${kept} kept, ${dropped} dropped`);
writeFileSync(data("codex.md"), `${codex}\n`);
console.log(`[codex] data/codex.md: ${books.length}/24 books, ${codex.length} chars (~${Math.round(codex.length / 4)} tokens)`);
