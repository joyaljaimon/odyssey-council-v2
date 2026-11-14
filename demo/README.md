Owned by Role 4.

- [script.md](script.md): the ~3 minute demo script, who speaks when, and the fallbacks
- [pitch.md](pitch.md): pitch deck outline (problem, demo, how it works, roadmap)
- `backup-stage.webm`: backup video of the stage running the scripted demo (52 s, 1280x720, no audio).
  Re-record with Brain and Stage running: `node demo/record-backup.mjs` (defaults to localhost:3000 / :8080).
- Rehearse without Gemini or a phone: open `http://localhost:3000/stage?sessionId=demo`, then
  `curl -X POST "localhost:8080/debug/demo?sessionId=demo"`.
