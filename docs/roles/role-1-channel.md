# Role 1: Channel

**Branch:** `role/channel` · **Folder:** `channel/` · **Port:** 8081

You own the phone number and everything that touches Chert: incoming texts and calls, outgoing replies and
attachments, and getting the stage video into the FaceTime call.

**Deliverable:** a number a judge can text and FaceTime that reaches our backend.

## Where things are

- [channel/src/server.ts](../../channel/src/server.ts) — webhook server. The webhook body shape is FAKE until you
  replace it with Chert's real one. `askBrain()` already calls Brain's `/text`.
- [channel/src/stage-capture.ts](../../channel/src/stage-capture.ts) — opens the stage in headless Chromium at
  1280x720. Run `npx playwright install chromium` once, then `npm run capture -w channel` to save a screenshot.
- Contracts you use: `TextRequest`, `TextReply`, `VoiceControlMessage`, `USER_AUDIO_SAMPLE_RATE`,
  `AGENT_AUDIO_SAMPLE_RATE` in [contracts/types.ts](../../contracts/types.ts).

## Checklist

### Hours 0–2: the make-or-break check
Nobody knows yet exactly how Chert's FaceTime framework accepts audio and video. Find out first.

- [ ] Create the Chert account, get the API key and agent number; add the key names to `.env.example`.
- [ ] Clone `cherthq/chert-facetime-opensource`, read its README, confirm hosting needs (Apple hardware, macOS, etc.).
- [ ] Get its example test call working with your own phone.
- [ ] Answer in the team chat: Can we send our own video track? In what form (WebRTC track, frames, virtual
      camera)? What audio format goes in and out? Can we send image attachments over iMessage?

### Hours 2–8: text path, then voice path
- [ ] ngrok tunnel; point Chert's webhooks at `channel/`. Share the URL as `PUBLIC_BASE_URL`.
- [ ] Text: on each incoming message call `POST {BRAIN_URL}/text`, send back `text` and each attachment URL.
      Works against Brain's stub today.
- [ ] Typing indicator while waiting for Brain, if Chert supports it.
- [ ] Voice: on an incoming FaceTime call, open `{BRAIN_URL}/voice?sessionId=...`, stream caller audio in
      (PCM16 mono 16 kHz), play Brain's audio (PCM16 mono 24 kHz) into the call. Resample if Chert differs.
- [ ] On `{ "type": "interrupted" }` from Brain, drop any queued audio immediately.

### Hours 8–16: the stage as the agent's video
- [ ] Use `startStageCapture(sessionId)` to open `{STAGE_URL}/stage?sessionId=...` and capture it as video.
- [ ] Feed that video to Chert as the agent's video track, using the method found in hour 0.
- [ ] One browser per call: start on connect, stop on hang-up.
- [ ] **Hour 12 go/no-go.** If video capture isn't working, switch to the fallback: text the caller a link to
      the stage page at the start of the call. Tell everyone which way it went.

### Final stretch
- [ ] 10 full test calls; log latency from user speech to character speech.
- [ ] Backup number or tester account for the demo.

## You need from others
| From | What | By hour |
| --- | --- | --- |
| Role 2 Brain | Stub `/text`, `/voice` (already in repo), then real ones | 2 / 10 |
| Role 4 Experience | Stage URL ready to stream at 1280x720; summary-card URL format | 8 |

## You must tell others
| To | What | By hour |
| --- | --- | --- |
| Role 2 Brain | Audio format Chert sends/accepts; whether interruptions reach us | 2 |
| Role 4 Experience | Video size and frame rate Chert accepts; streamed vs. link fallback | 2 |
| Role 4 Experience | iMessage attachment size and format limits | 4 |
| Everyone | Go / no-go on streaming video into FaceTime | 12 |
| Everyone | New ngrok `PUBLIC_BASE_URL` whenever it changes | any time |
