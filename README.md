# Homer's Odyssey

> Every great solution begins with an Odyssey.

Text or FaceTime a character from the Odyssey. On calls, the agent's video is a live "stage": a talking character,
the text with the current passage highlighted, and scene images or maps.

## Who owns what

| Role | Branch | Folder |
| --- | --- | --- |
| 1. Channel (Chert, FaceTime, iMessage) | `role/channel` | `channel/` |
| 2. Brain (Gemini Live, characters) | `role/brain` | `brain/` |
| 3. Story (text, episodes, retrieval) | `role/story` | `story/` |
| 4. Experience (stage, art, demo) | `role/experience` | `stage/`, `assets/`, `demo/` |
| Everyone (announce changes first) | any | `contracts/`, `.env.example`, this README |

Work on your branch, touch only your folder, and merge into `main` with a pull request.

## Run locally

Requires Node 20.6+.

```bash
npm install
cp .env.example .env          # fill in keys
npm run dev:brain             # :8080
npm run dev:stage             # :3000 -> open http://localhost:3000/stage?sessionId=demo&debug=1
npm run dev:channel           # :8081
```

Smoke test (with brain + stage running):

```bash
# Text path (what Channel does for iMessage)
curl -s localhost:8080/text -H 'content-type: application/json' \
  -d '{"sessionId":"demo","from":"+10000000000","message":"I keep scrolling my phone instead of studying","channel":"imessage"}'

# Push a stage event by hand
curl -s "localhost:8080/debug/emit?sessionId=demo" -H 'content-type: application/json' \
  -d '{"type":"highlight","passageIds":["12.1"]}'
```

## Daily git loop

```bash
git add <your-folder>
git commit -m "brain: add highlight_passage tool"
git fetch origin && git rebase origin/main
git push --force-with-lease
# then open a PR from your branch into main
```

## Contracts

`contracts/types.ts` (API, socket and data shapes) and `contracts/tools.json` (Gemini tool declarations)
are shared. Announce changes in the team chat and bump `contract version` before merging.

