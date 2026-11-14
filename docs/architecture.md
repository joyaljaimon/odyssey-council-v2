# Architecture

Brain is the hub. Channel passes it every text and call, Story feeds it knowledge, and it pushes events that
make the stage move. The stage is a web page that Channel films with headless Chromium and sends into FaceTime
as the agent's video.

```
 Caller's phone <-> Chert <-> Channel (Role 1) ----text + audio----> Brain (Role 2) <--live audio--> Gemini Live API
                                   ^                                   |      ^
                                   | stage video                events |      | import
                                   |                                   v      |
                              Stage page (Role 4) <----------------------   Story (Role 3)
                                   ^   ^__________ passages.json ___________/
                                   |
                              Assets (Role 4): portraits, mouths, scenes, map
```

On a call: user voice → Chert → Channel → Brain → Gemini. The character's voice and stage events come back the
same way, and the stage video goes stage page → Channel (headless Chromium) → Chert.

On a text: Chert webhook → Channel → `POST /text` → Brain → `TextReply` (text + image attachments) → Channel → Chert.

## Key decisions

| Decision | Choice |
| --- | --- |
| Voice and reasoning | Gemini Live API (real-time voice, interruptions, function calling) |
| Visuals in sync with speech | The model calls tools like `highlight_passage`; Brain forwards them as stage events over WebSocket |
| Character animation | 2D layered portrait; mouth image picked from audio loudness (4 shapes) |
| Stage into FaceTime | Headless Chromium renders the stage; its video becomes the agent's video track |
| Images | Pre-generated, stored by `sceneId`; never generated live |
| Text | Samuel Butler's 1900 prose translation (Gutenberg #1727), cited as `book.paragraph` |
| MVP characters | Athena (default guide), Odysseus, Poseidon (debate antagonist); Circe is a stretch |
| Memory | Per session only |
| Language | TypeScript, npm workspaces |
| Safety | Agent says it's an AI in its first message; no video recording or emotion detection |

## Ports

| Service | Port |
| --- | --- |
| Brain | 8080 |
| Channel | 8081 |
| Stage | 3000 |

All interface shapes live in [contracts/types.ts](../contracts/types.ts) and [contracts/tools.json](../contracts/tools.json).
