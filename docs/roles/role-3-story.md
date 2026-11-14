# Role 3: Story

**Branch:** `role/story` · **Folder:** `story/`

You own the content and its accuracy: the numbered text, the episode database, character guides, and retrieval.

**Deliverable:** `passages.json`, `episodes.json`, `characters.json`, plus `search()` and `findEpisode()` that
Brain imports.

## Where things are

- [story/index.ts](../../story/index.ts) — exports `passages`, `episodes`, `characters`, `search()`,
  `findEpisode()`, `getCharacter()`. Retrieval is keyword-based for now; keep the signatures when you upgrade it.
- [story/scripts/build-passages.ts](../../story/scripts/build-passages.ts) — splits Butler's translation into
  `book.paragraph` passages. Not yet run against the real file; check the `BOOK I` heading regex.
- [story/data/](../../story/data/) — `passages.json` (placeholder), `episodes.json` (Sirens, Lotus Eaters),
  `characters.json` (Athena).
- Shapes: `Passage`, `Episode`, `Character` in [contracts/types.ts](../../contracts/types.ts).

```bash
npm run download -w story          # fetches Gutenberg #1727 into story/raw/ (gitignored)
npm run build:passages -w story    # writes story/data/passages.json
```

## Checklist

### Hours 0–2: text and sample data
- [ ] Download and build `passages.json`; spot-check that book and paragraph numbers look right.
- [ ] Fill `keyQuotes` and `passageIds` for the 2 sample episodes using real passage ids.

### Hours 2–8: episodes and characters
- [ ] At least 12 episodes: Telemachus and the suitors, Calypso, the Phaeacians, the Lotus Eaters, the Cyclops,
      Aeolus and the winds, Circe, the Underworld, the Sirens, Scylla and Charybdis, the cattle of Helios, the
      return to Ithaca.
- [ ] Per episode: summary, characters, themes, 2–3 life lessons, problem tags, 2–3 key quotes with passage ids,
      `sceneId`, `locationId`.
- [ ] `characters.json` for Athena, Odysseus, Poseidon, Circe: bio, tone, speech rules, 5 sample lines each.
      Leave `voice` for Brain to fill.
- [ ] Problem-to-episode table: 30 everyday problems → best episode + one-sentence reason. Put it in
      `story/data/problem-map.json` as `{ problem, episodeId, why }[]` so Brain can test against it.

### Hours 8–16: retrieval
- [ ] Embed every passage and episode summary with the Gemini embeddings API → `story/data/embeddings.json`.
- [ ] Switch `search()` and `findEpisode()` to cosine similarity. No vector DB needed at this size.
- [ ] Add a script that checks every `keyQuotes[].text` really appears in its passage.

### Final stretch
- [ ] "Your Ithaca" reflection template: title, episode, lesson, one action for this week.
- [ ] 10 quiz questions with answers and passage ids (stretch).
- [ ] Fact-check what the characters say during test calls.

## You need from others
| From | What | By hour |
| --- | --- | --- |
| Role 4 Experience | Confirmation of which `sceneId` / `locationId` values have images | 10 |
| Role 2 Brain | Feedback on wrong episode picks | ongoing |

## You must tell others
| To | What | By hour |
| --- | --- | --- |
| Role 2 Brain | Sample files merged (already done in skeleton) | 2 |
| Role 4 Experience | Episode list with `sceneId`, `locationId` and a one-line scene description each | 4 |
| Role 4 Experience | Passage id format and how book titles should display | 4 |
| Role 2 Brain | Real `search()` / `findEpisode()` and full data files merged | 10 |
| Role 4 Experience | Demo problem, episode and 3 quotes worth highlighting | 16 |
