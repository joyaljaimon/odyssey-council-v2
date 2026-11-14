# Channel (Role 1)

Gets callers to Brain: FaceTime voice + the stage as video, and texts.

## FaceTime on a Chert line (managed, recommended)
Follows [Chert's agent skill](https://app.trychert.com/skills.md). The Chert CLI needs Node 22, 24 or 26
(`/usr/local/bin/node` is 24 on the demo Mac; Node 25 is rejected).

1. Once: `npx --yes @trychert/facetime@0.1.0-beta.21 onboard` (browser sign-in, text the code from your iPhone's
   iMessage, answer Chert's demo call). Then, in `channel/`:
   `npx @trychert/facetime@0.1.0-beta.21 setup --env-file .env.local --project <project id>`.
2. `channel/.env.local` (gitignored): `AGENT_NAME=odyssey-council` and your LiveKit project's `LIVEKIT_URL`,
   `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` (leave them empty on a Shared plan to use Chert rooms).
3. Run Brain and Stage, then in `channel/`:
   - terminal 1: `npm run chert` (our agent; registers as `AGENT_NAME`, or polls chert dev for Chert rooms)
   - terminal 2: `npx @trychert/facetime@0.1.0-beta.21 doctor`, then `... dev` (keep it running)
4. FaceTime **Video** the line. Brain greets when Chert signals `chert_bridge_ready`.

How a call flows ([src/chert.ts](src/chert.ts) → [src/agent-bridge.ts](src/agent-bridge.ts)): the caller joins the
LiveKit room as `chert-bridge-<call id>`; we publish exactly one audio track (Brain's 24 kHz voice) and one camera
track (the stage, captured by headless Chromium at 1280x720, [src/stage-capture.ts](src/stage-capture.ts)); caller
audio goes to Brain at 16 kHz; `{type:"interrupted"}` clears queued audio. Shared lines allow one call at a time and
5 minutes per call on the trial.

Fallback (no video): `CHERT_VIDEO=0 npm run chert` and share `/stage?sessionId=facetime-<call id>` (printed per call).

## FaceTime without a Chert line (open-source connector)
`npm run facetime` uses `@trychert/facetime-opensource`: create a FaceTime link on an iPhone, paste it at the hidden
prompt, click Join in Chrome, admit the guest on the iPhone, press Enter. Needs your own LiveKit project in `.env`.

## Texts
- `npm run chat`: terminal stand-in for iMessage against Brain's `/text` (same request/reply as the real path).
- iMessage on the Chert line: [src/server.ts](src/server.ts) is the webhook receiver. Chert's shared-line API
  (`POST/GET /api/v1/shared-messages`) is wired up once the line exists and the response shapes are confirmed.

## Checks
`npm run capture` writes `stage-test.png` and reports the screencast frame rate.
