// GET/POST /debug/demo?sessionId=demo : plays a scripted ~45 s conversation on the stage (no Gemini needed).
// Used to build and rehearse the stage, and to record the backup video.
import type { CharacterId, StageEvent } from "@odyssey/contracts";
import { emit } from "./stage.ts";

type Step = { wait: number; event?: StageEvent; say?: { who: CharacterId; text: string } };

const script: Step[] = [
  { wait: 0, event: { type: "clear" } },
  { wait: 300, event: { type: "character", character: "athena" } },
  { wait: 300, say: { who: "athena", text: "I'm an AI playing Athena. Tell me, traveler, what storm are you sailing through?" } },
  { wait: 2500, event: { type: "caption", text: "You: I keep scrolling my phone instead of studying." } },
  { wait: 2500, event: { type: "map", locationId: "sirens-isle" } },
  { wait: 200, say: { who: "athena", text: "Odysseus faced this too. Off the island of the Sirens, a song no sailor could resist." } },
  { wait: 300, event: { type: "scene", sceneId: "sirens" } },
  { wait: 400, event: { type: "character", character: "odysseus" } },
  { wait: 200, say: { who: "odysseus", text: "I didn't trust my willpower. I told my men: if I beg you to set me free, bind me more tightly still." } },
  { wait: 0, event: { type: "highlight", passageIds: ["12.13"] } },
  { wait: 3000, event: { type: "highlight", passageIds: ["12.14"] } },
  { wait: 200, say: { who: "odysseus", text: "Wax for their ears, rope for me. So what's your mast?" } },
  { wait: 1500, event: { type: "character", character: "odysseus", side: "left" } },
  { wait: 0, event: { type: "character", character: "poseidon", side: "right" } },
  { wait: 200, say: { who: "poseidon", text: "Ropes! The sea respects no cleverness. Respect the storm, mortal, and stay off its rocks." } },
  { wait: 200, say: { who: "odysseus", text: "Respect it, yes. But plan for it before it sings." } },
  { wait: 800, event: { type: "character", character: "athena" } },
  { wait: 200, say: { who: "athena", text: "Your Ithaca: tie yourself to the mast before the song starts. This week, phone in the kitchen for your first two study hours." } },
  { wait: 0, event: { type: "caption", text: "Your Ithaca: tie yourself to the mast before the song starts." } },
];

let running = new Map<string, boolean>();

export async function playDemo(sessionId: string) {
  if (running.get(sessionId)) return;
  running.set(sessionId, true);
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  try {
    for (const step of script) {
      await sleep(step.wait);
      if (step.event) emit(sessionId, step.event);
      if (step.say) {
        emit(sessionId, { type: "caption", text: step.say.text });
        // Fake speech: ~65 ms per character, syllable-shaped mouth levels every 50 ms.
        const ms = step.say.text.length * 65;
        for (let t = 0; t < ms; t += 50) {
          const syl = Math.abs(Math.sin(t / 90)) * (0.55 + 0.45 * Math.abs(Math.sin(t / 370)));
          emit(sessionId, { type: "mouth", character: step.say.who, level: Math.round(syl * 100) / 100 });
          await sleep(50);
        }
        emit(sessionId, { type: "mouth", character: step.say.who, level: 0 });
        await sleep(400);
      }
    }
  } finally {
    running.delete(sessionId);
  }
}
