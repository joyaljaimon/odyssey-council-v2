# Role 4: Experience

**Branch:** `role/experience` · **Folders:** `stage/`, `assets/`, `demo/` · **Port:** 3000

You own everything the user sees: the stage page (talking character, highlighted text, visuals), the art, the
summary card, the landing page, and the demo and pitch.

**Deliverable:** a stage page that reacts to stage events at 1280x720, a full asset folder, and a rehearsed demo.

## Where things are

- [stage/app/stage/Stage.tsx](../../stage/app/stage/Stage.tsx) — the stage. Connects to
  `{NEXT_PUBLIC_BRAIN_WS}/stage?sessionId=...` with auto-reconnect and handles every `StageEvent`. Layout is a
  rough first pass.
- `localhost:3000/stage?sessionId=demo&debug=1` shows a debug panel that fires each event by hand — build
  without Brain.
- [stage/app/card/route.ts](../../stage/app/card/route.ts) — summary card, returns 501 for now.
- [stage/app/page.tsx](../../stage/app/page.tsx) — landing page.
- [assets/](../../assets/) — served at `/assets/...` through the `stage/public/assets` symlink.
- Push events from a terminal while Brain runs:
  `curl -s "localhost:8080/debug/emit?sessionId=demo" -H 'content-type: application/json' -d '{"type":"scene","sceneId":"sirens"}'`

## Asset naming (other roles depend on it)
- `assets/characters/<id>/body.png` + `mouth-0.png` … `mouth-3.png` (closed → wide), identical size so they stack.
  Ids: `athena`, `odysseus`, `poseidon`, `circe`.
- `assets/scenes/<sceneId>.png`, 1280x720, one per episode in `story/data/episodes.json`.
- `assets/map/base.png` + `assets/map/locations.json` (`x`, `y` in percent; current positions are placeholders).

## Checklist

### Hours 0–2: layout and art style
- [ ] Refine the 1280x720 layout: character lower left (~400x500), text panel right two thirds, scene/map above
      the text. Large type, high contrast, nothing important within 40 px of the edges (FaceTime crops).
- [ ] Pick one art style for every image (e.g. Greek red-figure vase painting); save the prompt prefix in
      `assets/README.md`.

### Hours 2–8: the talking character
- [ ] Generate each character as layers: body + 4 mouth images.
- [ ] Mouth: `mouth-0` under 0.1, `mouth-1` under 0.3, `mouth-2` under 0.6, else `mouth-3` (already wired).
      Add an idle blink or sway so the character never looks frozen.
- [ ] Cross-fade on `character` events. Debate mode: two characters, left and right, dim the silent one.

### Hours 8–16: text, visuals, card
- [ ] Text panel: show book titles, scroll to and fade a gold highlight over `highlight` passages.
- [ ] Scene panel: cross-fade scenes; on `map`, show the journey map with a pulsing marker and a dotted route
      from Troy.
- [ ] Generate a scene image per episode Role 3 lists, plus the journey map.
- [ ] `/card?sessionId=...`: 1080x1350 "Your Odyssey" PNG (episode, quote, lesson, takeaway) via `next/og`.
- [ ] Landing page: number, tagline, characters.

### Final stretch
- [ ] Demo script (~3 min) around one problem in `demo/`; rehearse at least 3 times with the team.
- [ ] Pitch deck: problem, demo, how it works, roadmap (more myths, quiz mode, group calls).
- [ ] Record a backup video of a full working demo.

## You need from others
| From | What | By hour |
| --- | --- | --- |
| Role 1 Channel | Video size/frame rate Chert accepts; streamed vs. link; iMessage attachment limits | 2 / 4 |
| Role 2 Brain | Stage socket stub (already in repo); voice per character; mouth-event rate | 2 / 8 |
| Role 3 Story | Episode list with scene descriptions; passage id format; demo episode and quotes | 4 / 16 |

## You must tell others
| To | What | By hour |
| --- | --- | --- |
| Role 1 Channel | Stage URL ready to stream; card URL format | 8 |
| Roles 2 and 3 | Final list of `sceneId` / `locationId` values that have images | 10 |
| Role 2 Brain | If the mouth looks too jumpy or too slow | ongoing |
| Everyone | Demo script and rehearsal times | final stretch |
