// GET/POST /debug/demo?sessionId=demo : plays a scripted ~45 s conversation on the stage (no Gemini needed).
// Used to build and rehearse the stage, and to record the backup video.
import type { CharacterId, StageEvent } from "@odyssey/contracts";
import { emit } from "./stage.ts";

type Step = { wait: number; event?: StageEvent; say?: { who: CharacterId; text: string } };

const script: Step[] = [
  { wait: 0, event: { type: "clear" } },
  { wait: 1800, event: { type: "mode", mode: "life" } },
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

// POST /debug/demo?sessionId=...&script=story : Odysseus tells the wooden horse in Story Mode.
const story: Step[] = [
  { wait: 0, event: { type: "clear" } },
  { wait: 1800, event: { type: "mode", mode: "philosophy" } },
  { wait: 300, event: { type: "character", character: "odysseus" } },
  { wait: 300, say: { who: "odysseus", text: "The wooden horse? Ah. Sit, and I'll tell you how Troy fell." } },
  { wait: 0, event: { type: "story_mode", active: true, title: "The Wooden Horse" } },
  { wait: 200, event: { type: "illustration", illustrationId: "trojan-horse", caption: "Built by Epeus, with Athena's help", animation: "pop" } },
  { wait: 0, event: { type: "gesture", character: "odysseus", gesture: "open" } },
  { wait: 0, event: { type: "highlight", passageIds: ["8.45"] } },
  { wait: 200, say: { who: "odysseus", text: "Ten years of siege, and walls no army could break. So Epeus built a horse of wood, with Athena's help." } },
  { wait: 200, event: { type: "illustration", illustrationId: "troy-walls", caption: "The Trojans drag it into their city", animation: "slide" } },
  { wait: 0, event: { type: "gesture", character: "odysseus", gesture: "point" } },
  { wait: 0, event: { type: "highlight", passageIds: ["8.46"] } },
  { wait: 200, say: { who: "odysseus", text: "And the Trojans themselves dragged it through their own gate." } },
  { wait: 200, event: { type: "illustration", illustrationId: "trojan-horse", caption: "Hidden inside, waiting", animation: "zoom" } },
  { wait: 0, event: { type: "gesture", character: "odysseus", gesture: "heart" } },
  { wait: 0, event: { type: "highlight", passageIds: ["4.22"] } },
  { wait: 200, say: { who: "odysseus", text: "Inside, in the dark, we did not breathe. Helen walked around it calling our names in our wives' voices." } },
  { wait: 200, event: { type: "illustration", illustrationId: "troy-walls", caption: "Out of the horse, and Troy falls", animation: "pop" } },
  { wait: 0, event: { type: "gesture", character: "odysseus", gesture: "raise" } },
  { wait: 0, event: { type: "highlight", passageIds: ["8.46"] } },
  { wait: 200, say: { who: "odysseus", text: "Then night came, and we climbed out, and Troy fell." } },
  { wait: 600, event: { type: "gesture", character: "odysseus", gesture: "none" } },
  { wait: 0, event: { type: "story_mode", active: false } },
  { wait: 0, event: { type: "illustration", illustrationId: null } },
  { wait: 200, say: { who: "odysseus", text: "Patience won that war, not strength. What wall are you trying to break?" } },
];

// &script=council : Athena alone, then the screen comes up with the gods' viewpoints on a question.
const council: Step[] = [
  { wait: 0, event: { type: "clear" } },
  { wait: 1800, event: { type: "mode", mode: "philosophy" } },
  { wait: 300, event: { type: "character", character: "athena" } },
  { wait: 300, say: { who: "athena", text: "I'm an AI playing Athena. What would you like to explore today?" } },
  { wait: 1500, event: { type: "caption", text: "You: Why did Odysseus shout his name at the Cyclops? Wasn't he supposed to be clever?" } },
  { wait: 2500, event: { type: "board", board: { title: "Hubris: pride before the fall", subtitle: "Odysseus shouts his name at the Cyclops", illustrationId: "laurel", viewpoints: [
    { god: "poseidon", stance: "He blinded my son, then bragged of it to the sky. Pride calls the storm that answers it." },
    { god: "athena", stance: "His cunning won the cave; his vanity lost him ten years. Win quietly." },
    { god: "zeus", stance: "Every boast is a debt, and fate always collects." },
  ] } } },
  { wait: 0, event: { type: "highlight", passageIds: ["9.38"] } },
  { wait: 0, event: { type: "gesture", character: "athena", gesture: "point" } },
  { wait: 200, say: { who: "athena", text: "Clever, yes. But he wanted the world to know it was him. My uncle Poseidon has never forgiven it." } },
  { wait: 0, event: { type: "gesture", character: "athena", gesture: "open" } },
  { wait: 200, say: { who: "athena", text: "Zeus would call it a debt. I call it a lesson. Where do you stand?" } },
  { wait: 0, event: { type: "gesture", character: "athena", gesture: "none" } },
];

// &script=adventure : Be Odysseus, one decision and its outcome.
const cyclopsTaunt = {
  step: 3, total: 9, title: "Escaping the Cyclops", sceneId: "cyclops",
  scenario: "You are back on the ship, pulling away from the shore. The blinded giant stands on the cliff, hurling rocks. Your men beg you to stay quiet.",
  choices: [{ key: "A", label: "Shout your real name so the world knows who beat him" }, { key: "B", label: "Row away in silence" }, { key: "C", label: "Mock him once more as Noman" }],
};
const adventureScript: Step[] = [
  { wait: 0, event: { type: "clear" } },
  { wait: 1800, event: { type: "mode", mode: "odysseus" } },
  { wait: 300, event: { type: "character", character: "athena" } },
  { wait: 200, event: { type: "adventure", adventure: { ...cyclopsTaunt, stats: { crew: 58, wrath: 2, favor: 7 } } } },
  { wait: 200, say: { who: "athena", text: "You are Odysseus now. The giant is blind and raging on the cliff. A, B or C?" } },
  { wait: 1500, event: { type: "caption", text: "You: B. Row away in silence." } },
  { wait: 1500, event: { type: "adventure", adventure: { ...cyclopsTaunt, stats: { crew: 58, wrath: 2, favor: 9 }, chosen: "B", homerKey: "A" } } },
  { wait: 0, event: { type: "highlight", passageIds: ["9.38"] } },
  { wait: 200, say: { who: "athena", text: "Noman leaves without a name, and Poseidon has no one to hunt. Homer's Odysseus could not resist shouting it." } },
  { wait: 800, event: { type: "adventure", adventure: { step: 9, total: 9, title: "Home to Ithaca", scenario: "", choices: [], stats: { crew: 41, wrath: 2, favor: 9 },
    ending: { title: "The Patient Captain", summary: "You chose as Homer's Odysseus did 4 of 9 times. You reach Ithaca with 41 of 60 men (he arrived alone)." } } } },
  { wait: 200, say: { who: "athena", text: "The Patient Captain. Forty-one men home. What would you do differently?" } },
];

let running = new Map<string, boolean>();

export async function playDemo(sessionId: string, which: "conversation" | "story" | "council" | "adventure" = "conversation") {
  if (running.get(sessionId)) return;
  running.set(sessionId, true);
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  try {
    for (const step of { conversation: script, story, council, adventure: adventureScript }[which]) {
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
