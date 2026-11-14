// Role 3 (Story) owns this file. Brain imports search() and findEpisode() from here.
//
// Two retrieval paths with the same results shape:
//   search(), findEpisode()                  sync, keyword (BM25-style with stemming + synonyms). Always works.
//   searchSemantic(), findEpisodeSemantic()  async, Gemini embeddings + cosine similarity. Used when
//                                            data/embeddings.json exists and GEMINI_API_KEY is set; otherwise
//                                            they fall back to the keyword versions.
import type { Passage, Episode, Character } from "@odyssey/contracts";
import passagesJson from "./data/passages.json" with { type: "json" };
import episodesJson from "./data/episodes.json" with { type: "json" };
import charactersJson from "./data/characters.json" with { type: "json" };
import bookTitlesJson from "./data/book-titles.json" with { type: "json" };

export const passages = passagesJson as Passage[];
export const episodes = episodesJson as Episode[];
export const characters = charactersJson as Character[];
export const bookTitles = bookTitlesJson as Record<string, string>;

const passageById = new Map(passages.map((p) => [p.id, p]));
export const getPassage = (id: string) => passageById.get(id);
export const getEpisode = (id: string) => episodes.find((e) => e.id === id);

// ---------- keyword retrieval ----------

const STOP = new Set(
  "a an and are as at be been but by can could did do does doing for from had has have he her him his how i i'm im if in into is it its just me more my myself no not of on or our out over really so some still such than that the their them then there they this to too up very was we were what when which while who why will with would you your yourself keep keeps get gets got feel feeling want".split(" "),
);

// Everyday words -> words that appear in episode tags/themes.
const SYNONYMS: Record<string, string[]> = {
  phone: ["distraction", "temptation"], instagram: ["social", "media"], tiktok: ["social", "media", "scrolling"],
  scroll: ["scrolling", "distraction"], smoke: ["addiction", "quitting", "habits"], smoking: ["addiction", "quitting", "habits"],
  vape: ["addiction", "habits"], diet: ["temptation", "self-control"], eat: ["temptation"], eating: ["temptation"],
  study: ["studying", "procrastination"], studying: ["procrastination"], homework: ["procrastination"],
  lazy: ["laziness", "procrastination"], game: ["video", "games"], games: ["video"], gaming: ["video", "games"],
  watch: ["binge", "watching"], shows: ["binge", "netflix"], trapped: ["stuck", "golden", "cage"],
  miserable: ["unhappy", "unfulfilled"], salary: ["golden", "handcuffs"], pays: ["golden", "handcuffs"],
  quit: ["quitting", "leaving"], risky: ["big", "decision", "career", "change"], startup: ["career", "change", "big", "decision"],
  fine: ["comfortable", "unhappy"], moved: ["moving", "new", "city"], alone: ["lonely"], friends: ["making", "friends"],
  help: ["asking", "help"], proud: ["pride"], failed: ["starting", "over", "rock", "bottom"], fired: ["starting", "over", "rock", "bottom"],
  bully: ["bully", "bigger", "opponent"], bullied: ["bully"], manager: ["boss"], powerful: ["bigger", "opponent"],
  bragged: ["bragging", "ego", "pride"], brag: ["bragging", "ego"], mad: ["anger", "conflict"], argument: ["conflict"],
  hurt: ["revenge", "anger"], burned: ["burnout"], tired: ["exhausted", "burnout"], overwhelmed: ["burnout", "exhausted"],
  team: ["teamwork"], close: ["almost", "there", "setback"], apart: ["setback"],
  party: ["partying", "peer", "pressure"], drink: ["drinking"], alcohol: ["drinking"], toxic: ["toxic", "manipulation"],
  abusive: ["toxic", "relationship", "manipulation"], left: ["leaving"], leave: ["leaving"],
  died: ["death", "grief", "loss"], dead: ["death", "grief"], passed: ["death", "grief"], funeral: ["grief", "mourning"],
  famous: ["fame", "ambition"], success: ["ambition"], successful: ["ambition"], future: ["fear", "future", "advice"],
  choose: ["choosing", "hard", "decision"], options: ["two", "bad", "options", "dilemma"], decide: ["hard", "decision", "indecisive"],
  fire: ["layoffs"], laying: ["layoffs"], lay: ["layoffs", "sacrifice"], staying: ["leaving", "stuck"], checking: ["habits", "self-control"], cheat: ["cheating", "shortcut"], exam: ["cheating"], desperate: ["impatience"],
  spending: ["spending", "money"], saving: ["money", "delayed", "gratification"], impatient: ["impatience"],
  shy: ["confidence", "speaking", "up"], roommate: ["roommates"], advantage: ["people", "taking", "advantage"],
  grown: ["growing", "up"], confident: ["confidence"], insecure: ["self-doubt", "confidence"],
  nervous: ["anxiety"], reconnecting: ["reconnecting", "reunion"], partner: ["relationship"], trust: ["trust"],
};

// Light suffix stemmer: enough to match "procrastinating" with "procrastination".
function stem(w: string): string {
  return w
    .replace(/'s$/, "")
    .replace(/(ies)$/, "y")
    .replace(/(ations?|ating|ated|ates)$/, "ate")
    .replace(/(ing|ed|ers|er|es|s|ly)$/, "")
    .slice(0, 8);
}

const tokens = (s: string) => (s.toLowerCase().match(/[a-z][a-z'-]*/g) ?? []).filter((w) => !STOP.has(w));

function expand(query: string): string[] {
  const out: string[] = [];
  for (const w of tokens(query)) {
    out.push(stem(w));
    for (const s of SYNONYMS[w] ?? []) out.push(...tokens(s).map(stem));
  }
  return out;
}

type Doc<T> = { item: T; fields: { text: string; weight: number }[] };
type Index<T> = { docs: { item: T; tf: Map<string, number>; len: number }[]; idf: Map<string, number>; avg: number };

function buildIndex<T>(docs: Doc<T>[]): Index<T> {
  const df = new Map<string, number>();
  const built = docs.map((d) => {
    const tf = new Map<string, number>();
    let len = 0;
    for (const f of d.fields)
      for (const t of tokens(f.text).map(stem)) {
        tf.set(t, (tf.get(t) ?? 0) + f.weight);
        len++;
      }
    for (const t of tf.keys()) df.set(t, (df.get(t) ?? 0) + 1);
    return { item: d.item, tf, len };
  });
  const N = built.length;
  const idf = new Map([...df].map(([t, n]) => [t, Math.log(1 + (N - n + 0.5) / (n + 0.5))]));
  return { docs: built, idf, avg: built.reduce((s, d) => s + d.len, 0) / Math.max(1, N) };
}

function rank<T>(index: Index<T>, query: string, k: number): { item: T; score: number }[] {
  const q = expand(query);
  const k1 = 1.2, b = 0.75;
  return index.docs
    .map((d) => {
      let score = 0;
      for (const t of q) {
        const f = d.tf.get(t);
        if (!f) continue;
        score += (index.idf.get(t) ?? 0) * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.len) / index.avg)));
      }
      return { item: d.item, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

const passageIndex = buildIndex(passages.map((p) => ({ item: p, fields: [{ text: p.text, weight: 1 }] })));
const episodeIndex = buildIndex(
  episodes.map((e) => ({
    item: e,
    fields: [
      { text: e.problemTags.join(" "), weight: 3 },
      { text: [e.title, ...e.themes].join(" "), weight: 2 },
      { text: [...e.lessons, e.summary].join(" "), weight: 1 },
    ],
  })),
);

export function search(query: string, k = 5): Passage[] {
  return rank(passageIndex, query, k).map((x) => x.item);
}

export function findEpisode(problem: string, k = 3): Episode[] {
  const ranked = rank(episodeIndex, problem, k).map((x) => x.item);
  // Always return k results so the model has options; pad with the most broadly useful episodes.
  for (const id of ["calypso", "sirens", "phaeacians"]) {
    if (ranked.length >= k) break;
    const e = getEpisode(id);
    if (e && !ranked.includes(e)) ranked.push(e);
  }
  return ranked;
}

export function getCharacter(id: Character["id"]): Character | undefined {
  return characters.find((c) => c.id === id);
}

// ---------- semantic retrieval (Gemini embeddings) ----------

export const EMBEDDING_MODEL = "gemini-embedding-001";
type Embeddings = { model: string; passages: Record<string, number[]>; episodes: Record<string, number[]> };
let embeddings: Embeddings | null | undefined;

async function loadEmbeddings(): Promise<Embeddings | null> {
  if (embeddings !== undefined) return embeddings;
  try {
    const { readFile } = await import("node:fs/promises");
    embeddings = JSON.parse(await readFile(new URL("./data/embeddings.json", import.meta.url), "utf8")) as Embeddings;
  } catch {
    embeddings = null;
  }
  return embeddings;
}

export async function embed(texts: string[], taskType: "RETRIEVAL_QUERY" | "RETRIEVAL_DOCUMENT"): Promise<number[][]> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not set");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`,
    {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        requests: texts.map((text) => ({
          model: `models/${EMBEDDING_MODEL}`,
          content: { parts: [{ text }] },
          taskType,
          outputDimensionality: 768,
        })),
      }),
    },
  );
  if (!res.ok) throw new Error(`embed ${res.status}: ${await res.text()}`);
  const json = (await res.json()) as { embeddings: { values: number[] }[] };
  return json.embeddings.map((e) => e.values);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na * nb) || 1);
}

async function semantic<T>(query: string, table: Record<string, number[]> | undefined, lookup: (id: string) => T | undefined, k: number) {
  if (!table || !process.env.GEMINI_API_KEY) return null;
  try {
    const [q] = await embed([query], "RETRIEVAL_QUERY");
    return Object.entries(table)
      .map(([id, v]) => ({ id, s: cosine(q, v) }))
      .sort((a, b) => b.s - a.s)
      .slice(0, k)
      .map((x) => lookup(x.id))
      .filter((x): x is T => !!x);
  } catch (err) {
    console.warn("[story] semantic search failed, using keywords:", (err as Error).message);
    return null;
  }
}

export async function searchSemantic(query: string, k = 5): Promise<Passage[]> {
  const e = await loadEmbeddings();
  return (await semantic(query, e?.passages, getPassage, k)) ?? search(query, k);
}

export async function findEpisodeSemantic(problem: string, k = 3): Promise<Episode[]> {
  const e = await loadEmbeddings();
  const sem = await semantic(problem, e?.episodes, getEpisode, k);
  if (!sem) return findEpisode(problem, k);
  // Blend: keep the keyword winner if it isn't already in the semantic top k (tags are hand-curated).
  const [kw] = findEpisode(problem, 1);
  return kw && !sem.includes(kw) ? [...sem.slice(0, k - 1), kw] : sem;
}
