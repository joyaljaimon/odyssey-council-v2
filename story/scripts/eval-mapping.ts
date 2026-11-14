// Scores findEpisode() (and findEpisodeSemantic() if embeddings + key exist) against data/problem-map.json.
// Run: npm run eval -w story
import { findEpisode, findEpisodeSemantic } from "../index.ts";
import problemMap from "../data/problem-map.json" with { type: "json" };

const semantic = process.argv.includes("--semantic");
let top1 = 0, top3 = 0;
for (const { problem, episodeId } of problemMap) {
  const ids = (semantic ? await findEpisodeSemantic(problem, 3) : findEpisode(problem, 3)).map((e) => e.id);
  if (ids[0] === episodeId) top1++;
  if (ids.includes(episodeId)) top3++;
  else console.log(`✗ "${problem}" -> expected ${episodeId}, got ${ids.join(", ")}`);
  if (ids[0] !== episodeId && ids.includes(episodeId)) console.log(`~ "${problem}" -> ${episodeId} ranked #${ids.indexOf(episodeId) + 1} (${ids.join(", ")})`);
}
const n = problemMap.length;
console.log(`${semantic ? "semantic" : "keyword"}: top-1 ${top1}/${n} (${Math.round((100 * top1) / n)}%), top-3 ${top3}/${n} (${Math.round((100 * top3) / n)}%)`);
