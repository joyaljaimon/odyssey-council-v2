// Off-topic guardrail for text mode: obvious non-Odyssey requests are declined before reaching the model.
// The system prompt carries the same rule for everything subtler (and for voice, where there is no text to check).
import type { CharacterId } from "@odyssey/contracts";

const OFF_TOPIC: RegExp[] = [
  /^\s*(what('?s| is)|calculate|compute|solve)?\s*[-+]?\d[\d\s.,]*\s*([+\-*/x×÷^%]|plus|minus|times|divided by)\s*[-+]?\d[\d\s.,+\-*/x×÷^%()]*\??\s*$/i, // 2+2, what is 12 x 7
  /\b(square root|derivative|integral|equation|algebra|calculus)\b/i,
  /\b(write|debug|fix|explain)\b.{0,30}\b(code|python|javascript|typescript|java|c\+\+|sql|html|css|regex|function|program|script)\b/i,
  /\b(python|javascript|typescript|sql|html|css)\b.{0,20}\b(code|function|script|error|bug)\b/i,
  /\b(weather|forecast|temperature)\b.{0,25}\b(today|tomorrow|in [a-z]+|this week)\b/i,
  /\b(stock|share|bitcoin|crypto|ethereum)\b.{0,20}\b(price|worth|buy|sell)\b/i,
  /\b(who won|score of|final score)\b.{0,40}\b(game|match|super bowl|world cup|nba|nfl|election)\b/i,
  /\b(capital of|population of|translate (this|to))\b/i,
  /\b(recipe|how (do i|to) (cook|bake))\b/i,
];

const ODYSSEY = /\b(odyss|ulysses|homer|ithaca|athena|minerva|poseidon|neptune|zeus|jove|circe|calypso|cyclops|polyphemus|siren|troy|trojan|penelope|telemachus|suitor|god|goddess|myth|greek)/i;

export function offTopic(message: string): boolean {
  if (ODYSSEY.test(message)) return false; // anything that mentions the story is the model's call
  return OFF_TOPIC.some((re) => re.test(message));
}

const DECLINE: Record<CharacterId, string[]> = {
  athena: [
    "My wisdom is for voyages, not sums or search engines. Ask me something the Odyssey can answer: a choice you're facing, or why Odysseus did what he did.",
    "That's a question for another oracle. I'm here for the Odyssey and the storms in your own life. What are you sailing through?",
  ],
  odysseus: ["I can count my men and my years at sea, nothing more. Ask me about the voyage, or your own."],
  poseidon: ["The sea does not answer such questions, mortal. Ask me of pride, wrath, or the voyage, or be gone."],
  circe: ["Clever, but my island deals in stranger things. Ask me about temptation, or the voyage."],
};

export function declineReply(who: CharacterId): string {
  const lines = DECLINE[who];
  return lines[Math.floor(Math.random() * lines.length)];
}
