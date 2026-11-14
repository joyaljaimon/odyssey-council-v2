# Demo script (~3 minutes)

**Problem:** "I keep scrolling my phone instead of studying."
**Episode:** The Sirens (Book XII). **Quotes to highlight:** 12.13 ("If I beg and pray you to set me free, then bind
me more tightly still."), 12.14 ("Then I stopped the ears of all my men, and they bound me hands and feet to the
mast"), 12.16 ("they quickened their stroke ... till we had got out of hearing of the Sirens' voices").

Roles on stage: **Presenter** (speaks to judges), **Caller** (holds the phone, plays the user), **Operator** (laptop
with stage, Brain logs and the backup video ready).

| Time | Who | What happens | Say / do |
| --- | --- | --- | --- |
| 0:00 | Presenter | Title slide | "Everyone has a storm: procrastination, a hard choice, a toxic friend. What if you could ask someone who's already sailed through it?" |
| 0:15 | Presenter | | "Homer's Odyssey: text or FaceTime a character from the Odyssey. Every great solution begins with an Odyssey." |
| 0:25 | Caller | Texts the number: "hi" | Screen-mirror the phone. Athena replies and says she's an AI. |
| 0:40 | Caller | Texts the problem | Athena replies with The Sirens, the real quote with its passage id, and the scene image. |
| 1:00 | Caller | FaceTimes the number | The agent's video shows the stage: Athena, the map with the route from Troy. |
| 1:10 | Caller | Says the problem out loud | Athena hands over to Odysseus; the Sirens scene appears; 12.13 is highlighted as he quotes it; his mouth moves with his voice. |
| 1:50 | Caller | "Should I just delete Instagram, or is that too much?" | Athena starts a debate: Odysseus (left) vs Poseidon (right); the silent one dims. |
| 2:20 | Caller | Picks a side, says "thanks, bye" | Athena gives "Your Ithaca"; the summary card arrives by text. |
| 2:35 | Presenter | Holds up the card | "One lesson and one action for this week, with the real line from Homer." |
| 2:45 | Presenter | How it works slide | "Gemini Live for voice, tools that drive the stage in sync with speech, every quote checked against Butler's translation, and the stage streamed in as the agent's video." |
| 3:00 | | End | |

## Fallbacks (Operator decides in the moment)
1. **Video into FaceTime fails:** keep voice; the caller opens the stage link that was texted at the start of the call.
2. **Call fails:** do the whole demo over text; the stage still updates live on the laptop (`/stage?sessionId=<phone>`).
3. **Everything fails:** play `demo/backup-stage.webm` and narrate the lines in the table.

## Before going on stage
- Brain, Stage and Channel running; `PUBLIC_BASE_URL` is the current ngrok URL; number tested 30 minutes before.
- Stage open on the laptop for the caller's session; backup video open in a second window.
- Phone on Do Not Disturb, volume up, screen mirroring tested.
