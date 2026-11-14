// Role 3 (Story) owns this file. Brain imports search() and findEpisode() from here.
import type { Passage, Episode, Character } from "@odyssey/contracts";
import passagesJson from "./data/passages.json" with { type: "json" };
import episodesJson from "./data/episodes.json" with { type: "json" };
import charactersJson from "./data/characters.json" with { type: "json" };

export const passages = passagesJson as Passage[];
export const episodes = episodesJson as Episode[];
export const characters = charactersJson as Character[];

const words = (s: string) => s.toLowerCase().match(/[a-z']+/g) ?? [];

function score(query: string, text: string): number {
  const q = new Set(words(query));
  return words(text).reduce((n, w) => n + (q.has(w) ? 1 : 0), 0);
}

// TODO(story): replace keyword scoring with Gemini embeddings + cosine similarity
// (vectors in data/embeddings.json). Keep these signatures.
export function search(query: string, k = 5): Passage[] {
  return passages
    .map((p) => ({ p, s: score(query, p.text) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => x.p);
}

export function findEpisode(problem: string, k = 3): Episode[] {
  return episodes
    .map((e) => ({ e, s: score(problem, [e.summary, ...e.problemTags, ...e.themes, ...e.lessons].join(" ")) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => x.e);
}

export function getCharacter(id: Character["id"]): Character | undefined {
  return characters.find((c) => c.id === id);
}
