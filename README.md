# The Odyssey Council

> FaceTime the gods and heroes of Homer's Odyssey. Ask anything, or hold something up to the camera, and the
> characters who were actually there answer, each in their own voice.

Ask *"Who's really to blame for the crew dying on the island of the Sun?"* and **Odysseus**, **Eurylochus**,
**Helios** and **Zeus** convene on your screen and argue it out: Odysseus warned them, Eurylochus says starving men
had no choice, Helios demanded vengeance, and Zeus reminds everyone that mortals blame the gods for their own folly.

Hold up a bow to your camera and **Penelope** remembers the contest of the axes.

Built for HackUTA, *Best Use of FaceTime (Chert)*.

## The one feature

You call. You ask. The right members of the Council answer.

- **It listens and looks at once.** Your question (audio) and your live FaceTime camera frame go to Gemini in a
  single call. Show the Council an object and it becomes part of the story: a phone is the Sirens' song, a dog is
  Argos, a cup is Circe's.
- **It picks the cast.** The Cyclops? Odysseus, Polyphemus and Poseidon. The suitors? Penelope, Telemachus and
  Antinous. 16 members, 2 to 4 speak per answer, and they disagree when their interests do.
- **Every character has a voice and a face.** Each line streams into its own Gemini voice the moment it is written;
  the video shows their oil portrait lit up, mouth moving, with the line as a subtitle and the episode's painting
  behind.
- **It shows you what they're talking about.** A library of 64 paintings (the wooden horse, the loom, Argos, the
  bag of winds…) springs up in the middle of the stage the moment a line mentions it, the Council parting to either side;
  it blooms from ink into colour, pans slowly, and leaves with its line as the Council closes ranks again. Each showing is framed and cropped differently, nothing
  repeats until ten others have been shown, and when the answer needs something the library lacks (Agamemnon in the
  net), a brand-new painting is made on the spot and joins the library.
- **It knows the whole book.** The full Samuel Butler translation was distilled offline into a book-by-book codex
  (`data/codex.md`), with 91 quotes verified word for word against the text.
- **You can cut in.** Talk over the Council and it stops at once and takes your new question; say "stop" or "wait"
  and it just goes quiet. A cough, an "mm" or its own echo doesn't count.
- **It stays on course.** Maths homework, code, news: Athena declines kindly and offers an Odyssey question instead.

## How it uses FaceTime

```
iPhone FaceTime ──▶ Chert line ──▶ LiveKit room ──▶ this agent
   your voice  ─────────────────────────────────▶  VAD ─┐
   your camera ─────────────────────────────────▶  latest frame ─┤
                                                         ▼
                                     Gemini: audio + frame ─▶ streamed script
                                     HEARD / SAW / TOPIC / SCENE / NAME: line
                                                         ▼
                                     Gemini TTS, one voice per character (streamed)
   their voices ◀───────────────────────────────── 24 kHz audio track
   the Council  ◀───────────────────────────────── 960×540 video, drawn in Node (canvas)
```

About **1.6 s** from the end of your question to the first voice (measured with `npm run e2e`).

### Built to work every time

- Several models per job and several API keys (`GEMINI_API_KEYS=a,b,c`); a model that is overloaded (503) or out of
  quota (429) is skipped and the next answers. Each attempt must start within seconds or the next one is tried.
- If every Gemini voice fails, the line is spoken with the Mac's own voice; if the script fails, Athena covers with
  a pre-recorded line. The greeting is pre-recorded, so Chert's 10-second greeting deadline is always met.
- One process, no browser: the video is drawn straight to pixels.

## Run it

Node 22 or 24 (Chert's CLI rejects 25).

```bash
npm install
cp .env.example .env               # GEMINI_API_KEY, plus the LiveKit keys from `chert setup`
npm run ask -- "Was Odysseus right to blind the Cyclops?"   # text test, no phone
npm run sim                        # http://localhost:8790: call from the browser with your mic + camera
```

On a real FaceTime call (two terminals):

```bash
npm start                                                                   # the agent
npx @trychert/facetime@0.1.0-beta.21 dev --agent odyssey-council --env-file .env   # connects the line
```

Then FaceTime **Video** the line.

| Command | What it does |
| --- | --- |
| `npm start` | The FaceTime agent (registers with LiveKit, or polls `chert dev` on Chert rooms) |
| `npm run sim` | Browser stand-in for a call: same Council, your mic and camera |
| `npm run ask -- "…" [--image x.jpg] [--speak]` | One Council turn in the terminal |
| `npx tsx --env-file=.env tools/barge-test.ts` | Interruptions in real time: echo and a cough ignored, talking over it stops it, "stop" goes quiet |
| `npm run e2e -- "…"` | A spoken question end to end; reports latency, saves reply audio and stage frames |
| `npm run codex` | Rebuilds `data/codex.md` from the full text (verifies every quote) |
| `npm run portraits` | Paints missing portraits (Meta Muse Image) |
| `npm run visions` | Paints missing pictures in `data/visions.json` |
| `npm run visions:png -- <dir>` | Renders frames of pictures arriving on the stage |

## Code

| File | |
| --- | --- |
| [src/council.ts](src/council.ts) | A call: listen, one Gemini turn, speak each line, keep the stage in sync with the audio |
| [src/script.ts](src/script.ts) | The prompt, the guardrails, and the streaming line parser |
| [src/gemini.ts](src/gemini.ts) | Streaming text and speech with key/model fallback; the `say` fallback |
| [src/stage.ts](src/stage.ts) | The video: portraits, subtitles, pictures, drifting light and waves, what the camera saw |
| [src/visions.ts](src/visions.ts) | Which picture goes with which line; paints new ones when the library has none |
| [src/bridge.ts](src/bridge.ts) | LiveKit room ↔ Council (caller audio + camera in, voice + video out) |
| [src/chert.ts](src/chert.ts) | Takes calls from the Chert line |
| [src/roster.ts](src/roster.ts) | The 16 members: who they are, their voices |

## The journey

The first version (kept alive at [joyaljaimon/odyssey-council](https://github.com/joyaljaimon/odyssey-council),
history preserved here) had three modes: *Be Odysseus* (a choose-your-path game), *Talk about life* (advice from
one god), and *The Council*. Four people, four packages, four processes, a headless Chrome filming a Next.js page
for the video, and a Gemini Live session torn down and reopened every time a different character spoke.

It worked, but it was slow and fragile, and the best moment of every demo was the same one: several characters
answering one question from their own side of the story. So v2 is only that, rebuilt around what makes FaceTime
different from a phone call: the Council sees what you show it.

## Credits

The Odyssey, translated by Samuel Butler (1900, public domain, Project Gutenberg). Portraits, paintings and the backdrop generated
with Meta Muse Image; the stage's look follows the HackUTA 2026 Odyssey theme. Fonts: Barlow Semi Condensed, EB Garamond
and Cinzel (SIL Open Font License, `assets/fonts/`). The characters are AI and
say so; calls are not recorded.
