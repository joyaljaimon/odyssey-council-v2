# Timeline, gates and fallbacks

Nobody starts the next phase's integration work until the gate is met. Do a 10-minute team check-in at each gate.

| Phase | Hours | Channel (1) | Brain (2) | Story (3) | Experience (4) | Gate |
| --- | --- | --- | --- | --- | --- | --- |
| Setup | 0–2 | Chert test call; answer the 4 questions | Stubs on main; pick Live voices | passages.json; 2 sample episodes | Stage layout; art style; debug UI | Contracts on main |
| Build | 2–8 | Texts reach Brain; call audio bridged | Athena end to end; tools emit events | 12 episodes; 30 problem mappings | Talking character; mouth from events | One call works end to end |
| Integrate | 8–16 | Stage streamed in; go/no-go at hour 12 | All characters; retrieval; debate | `search()` works; quotes verified | Text, scenes, map; summary card | Full demo flow works |
| Polish | 16–demo | 10 test calls; backup number | Fix episode picks; cut latency | Ithaca template; fact-check calls | Demo script, deck; backup video | 3 rehearsals done |

## Fallbacks, in order
1. **Video streaming fails:** keep voice on FaceTime and text the caller a link to the stage page at the start
   of the call. Same stage events, nothing else changes.
2. **Gemini Live voices too similar:** Gemini for reasoning + a separate TTS with distinct voices (Brain decides by hour 10).
3. **Live calls fail on demo day:** texting only, plus the backup video of a full call.
4. **Wi-Fi fails:** backup video, and the stage page running locally on a laptop.

## Demo-day checklist
- [ ] All four branches merged into `main`; `main` runs from a clean clone using the README.
- [ ] Keys loaded, ngrok running, number tested 30 minutes before.
- [ ] Backup phone, backup number and backup video ready.
- [ ] Demo script printed, with who speaks when.
