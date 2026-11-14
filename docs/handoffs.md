# Handoffs: who must tell whom

Every row blocks someone else's work. The sender posts it in the team chat and tags the receiver as soon as it's
ready. If you're the receiver and the hour passes, ask directly, and keep building against the stub meanwhile.
Hours count from the start of the hackathon.

| By hour | From | To | What to share |
| --- | --- | --- | --- |
| 2 | Everyone | Everyone | `contracts/` on `main`; `.env.example` has every key name (done in skeleton) |
| 2 | Channel (1) | Brain (2) | Audio format Chert sends and accepts; whether interruptions reach us |
| 2 | Channel (1) | Experience (4) | Video size and frame rate; whether the stage will be streamed or shown via link |
| 2 | Brain (2) | Channel (1), Experience (4) | Stub `/text`, `/voice`, `/stage` on `main` (done in skeleton) |
| 2 | Story (3) | Brain (2) | Sample `episodes.json`, `characters.json`, `passages.json` (samples in skeleton; real passages to build) |
| 4 | Channel (1) | Experience (4) | iMessage attachment size and format limits |
| 4 | Story (3) | Experience (4) | Episode list with `sceneId`, `locationId` and a one-line scene description each |
| 4 | Story (3) | Experience (4) | Passage id format and how book titles should display |
| 8 | Experience (4) | Channel (1) | Stage URL ready to stream; summary-card URL format |
| 8 | Brain (2) | Experience (4) | Voice per character; mouth-event rate |
| 10 | Story (3) | Brain (2) | Working `search()` and `findEpisode()`; full episode and character files |
| 10 | Experience (4) | Brain (2), Story (3) | Final list of `sceneId` and `locationId` values that have images |
| 12 | Channel (1) | Everyone | Go / no-go on streaming video into FaceTime (otherwise use the link fallback) |
| 16 | Brain (2) | Experience (4) | The working demo conversation, for the demo script |
| 16 | Story (3) | Experience (4) | Demo problem, episode and 3 quotes to highlight |
| Any time | Channel (1) | Everyone | New ngrok `PUBLIC_BASE_URL` |
| Any time | Anyone | Affected roles | Any change to `contracts/`, announced before merging |
