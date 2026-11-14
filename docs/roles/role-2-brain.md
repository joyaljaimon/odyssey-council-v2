# Role 2: Brain

**Branch:** `role/brain` · **Folder:** `brain/` · **Port:** 8080

You own the AI: the Gemini Live session, character personas, the tools that drive the stage, and the
problem-to-episode logic.

**Deliverable:** a server with the text API, voice socket and stage socket from the contracts, where each
character sounds and behaves differently.

## Where things are

- [brain/src/server.ts](../../brain/src/server.ts) — HTTP + WebSocket routing (`/text`, `/voice`, `/stage`,
  `/debug/emit`, `/health`).
- [brain/src/text.ts](../../brain/src/text.ts) — text mode. STUB: uses `findEpisode()` and a canned reply.
  Replace with Gemini + tools.
- [brain/src/voice.ts](../../brain/src/voice.ts) — voice mode. STUB with the 5 steps to implement in comments.
- [brain/src/stage.ts](../../brain/src/stage.ts) — `emit(sessionId, event)` fans events out to stage pages;
  `mouthLevel(pcm16)` turns an audio chunk into a 0..1 mouth level.
- [brain/src/personas/](../../brain/src/personas/) — one system prompt per character.
- [contracts/tools.json](../../contracts/tools.json) — the function declarations to register with Gemini.
- Story data and retrieval: `import { search, findEpisode, getCharacter, episodes } from "@odyssey/story"`.

Test without anyone else:
```bash
npm run dev:brain
curl -s localhost:8080/text -H 'content-type: application/json' \
  -d '{"sessionId":"demo","from":"+1","message":"I procrastinate","channel":"imessage"}'
```
Open `localhost:3000/stage?sessionId=demo` (Role 4's page) to see your events land.

## Checklist

### Hours 0–2: setup and stubs
- [ ] Google Cloud project + Gemini API key; `GEMINI_API_KEY` in `.env`.
- [ ] Stubs for `/text`, `/voice`, `/stage` are already on `main` — tell Roles 1 and 4 they can build against them.
- [ ] Pick the current Gemini Live model from Google's docs; list the available prebuilt voices.

### Hours 2–8: one character end to end
- [ ] Text mode: send the conversation to Gemini with Athena's system prompt and the tools; run tool calls;
      return a `TextReply`. Keep history per `sessionId` in memory (per-session memory only for the MVP).
- [ ] Voice mode: one Live session per call; pipe 16 kHz audio in and 24 kHz audio out; forward interruptions
      to Channel as `{ "type": "interrupted" }`.
- [ ] Tools: when the model calls `highlight_passage`, `show_scene` or `show_map`, `emit()` the matching event.
      In text mode, `show_scene` also adds an image attachment.
- [ ] Lip sync: for each outgoing audio chunk, `emit` a `mouth` event (~every 50 ms) using `mouthLevel()`;
      send `level: 0` when the character stops.

### Hours 8–16: all characters, retrieval, debate
- [ ] One system prompt per character from `story/data/characters.json`. Each: who you are, how you speak, say
      you're an AI at the start, spoken turns under ~30 s, always cite `book.paragraph`.
- [ ] Distinct Live voice per character; record it in `characters.json` (`voice` field — ask Role 3 or
      announce the edit, it's their file).
- [ ] `switch_character`: a Live session has one voice, so close it and open a new one with the new prompt and
      voice, passing a short summary of the conversation so far. Emit a `character` event.
- [ ] Wire `search_odyssey` → `search()` and `find_episode` → `findEpisode()`.
- [ ] Problem mapping flow: `find_episode` → pick one → tell that part of the story → `show_scene` →
      `highlight_passage` on a key quote → relate it to the user.
- [ ] Debate mode: alternate Odysseus vs. Poseidon for 2–3 short turns each, then let the user pick a side.
      Emit `character` events with `side: "left" | "right"`.
- [ ] `end_session`: 2-sentence "Your Ithaca" takeaway, plus the summary card URL `{STAGE_URL}/card?sessionId=...`
      as an attachment; set `sessionEnded: true`.
- [ ] Only call `scene_id` / `location_id` values Role 4 confirms have images.

### Final stretch
- [ ] Test the 30 problems in Role 3's mapping table; report wrong episode picks to Role 3.
- [ ] Measure latency; trim prompts if slow.
- [ ] **Fallback (decide by hour 10):** if Live voices are too similar, keep Gemini for reasoning and use a
      separate TTS with distinct voices.

## You need from others
| From | What | By hour |
| --- | --- | --- |
| Role 1 Channel | Chert's audio format; whether interruptions reach us | 2 |
| Role 3 Story | Sample data files (already in repo), then full episodes/characters and real `search()` | 2 / 10 |
| Role 4 Experience | Final list of `sceneId` and `locationId` values that have images | 10 |

## You must tell others
| To | What | By hour |
| --- | --- | --- |
| Roles 1 and 4 | Stubs are on `main` and how to run them | 2 |
| Role 4 Experience | Voice per character; mouth-event rate | 8 |
| Role 3 Story | Episodes the model keeps mismatching | ongoing |
| Role 4 Experience | The working demo conversation, for the demo script | 16 |
