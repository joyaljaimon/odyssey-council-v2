// Text mode (iMessage / SMS). Gemini + tools when GEMINI_API_KEY is set; a scripted offline Athena otherwise.
import { GoogleGenAI, type Content, type GenerateContentParameters, type GenerateContentResponse, type Part } from "@google/genai";
import type { Attachment, CharacterId, StageEvent, TextReply, TextRequest } from "@odyssey/contracts";
import { findEpisode, getCharacter, getEpisode } from "@odyssey/story";
import { systemPrompt } from "./persona.ts";
import { getSession, recap, type Session } from "./session.ts";
import { emit } from "./stage.ts";
import { cardUrl, functionDeclarations, runTool, sceneUrl } from "./tools.ts";

export const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL ?? "gemini-3.8-flash";
const MAX_TOOL_ROUNDS = 6;

// Tried in order when the main model is overloaded (503), rate limited (429) or too slow.
const FALLBACK_MODELS = (process.env.GEMINI_TEXT_FALLBACKS ?? "gemini-3.5-flash-lite,gemini-3.5-flash").split(",").map((m) => m.trim()).filter(Boolean);
const MODEL_TIMEOUT_MS = Number(process.env.GEMINI_TEXT_TIMEOUT_MS ?? 8000);
const COOLDOWN_MS = 2 * 60 * 1000; // after a model fails, skip it for a while instead of waiting on it every round
const downUntil = new Map<string, number>();

let ai: GoogleGenAI | null = null;
export const gemini = () => (process.env.GEMINI_API_KEY ? (ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY })) : null);

const statusOf = (err: unknown) => (err as { status?: number }).status ?? 0;
const retryable = (err: unknown) => [429, 500, 503, 504].includes(statusOf(err)) || (err as Error).name === "AbortError" || /abort|timed? ?out/i.test((err as Error).message ?? "");

/** generateContent with a time limit per model, moving down the fallback list on overload. Throws only if all fail. */
async function generate(params: Omit<GenerateContentParameters, "model">): Promise<GenerateContentResponse> {
  let last: unknown;
  const all = [TEXT_MODEL, ...FALLBACK_MODELS.filter((m) => m !== TEXT_MODEL)];
  const up = all.filter((m) => (downUntil.get(m) ?? 0) < Date.now());
  for (const model of up.length ? up : all) {
    const t0 = Date.now();
    try {
      const res = await gemini()!.models.generateContent({
        ...params,
        model,
        config: { ...params.config, abortSignal: AbortSignal.timeout(MODEL_TIMEOUT_MS) },
      });
      if (model !== TEXT_MODEL) console.warn(`[text] answered by fallback ${model} in ${Date.now() - t0} ms`);
      return res;
    } catch (err) {
      last = err;
      if (!retryable(err)) throw err;
      downUntil.set(model, Date.now() + COOLDOWN_MS);
      console.warn(`[text] ${model} unavailable (${statusOf(err) || "timeout"} after ${Date.now() - t0} ms), skipping it for 2 min`);
    }
  }
  throw last;
}

export async function handleText(req: TextRequest): Promise<TextReply> {
  const s = getSession(req.sessionId);
  if (s.summary.ended) {
    // A new message after the end starts a fresh conversation with Athena.
    Object.assign(s, { character: "athena", history: [], transcript: [], disclosed: false });
    s.summary = { sessionId: s.id, character: "athena", ended: false };
  }
  s.transcript.push({ who: "user", text: req.message });
  let reply: TextReply;
  if (gemini()) {
    const before = { history: s.history.length, character: s.character };
    try {
      reply = await geminiTurn(s, req.message);
    } catch (err) {
      // Every Gemini model failed: undo the half-finished turn and answer with the scripted Athena instead of an error.
      console.error("[text] Gemini failed, using offline reply:", (err as Error).message.slice(0, 200));
      s.history.length = before.history;
      s.character = before.character;
      reply = offlineTurn(s, req.message);
    }
  } else {
    reply = offlineTurn(s, req.message);
  }
  reply.text = ensureDisclosure(s, reply.character, reply.text);
  s.transcript.push({ who: reply.character, text: reply.text });
  s.summary.character = reply.character;
  for (const e of reply.stageEvents) emit(req.sessionId, e);
  return reply;
}

/** Safety net: the first agent message must say it is an AI, whatever the model did. */
function ensureDisclosure(s: Session, who: CharacterId, text: string): string {
  if (s.disclosed) return text;
  s.disclosed = true;
  if (/\bAI\b|artificial intelligence/i.test(text)) return text;
  return `(I'm an AI playing ${getCharacter(who)?.name ?? who}.) ${text}`;
}

// ---------------------------------------------------------------- Gemini

async function geminiTurn(s: Session, message: string): Promise<TextReply> {
  const reply: TextReply = { character: s.character, text: "", attachments: [], stageEvents: [], sessionEnded: false };
  s.history.push({ role: "user", parts: [{ text: message }] });

  let pendingSwitch: CharacterId | undefined;
  let debateTopic: string | undefined;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const res = await generate({
      contents: s.history,
      config: {
        systemInstruction: systemPrompt(s.character, "text", { firstTurn: !s.disclosed }),
        tools: [{ functionDeclarations }],
        temperature: 0.8,
      },
    });
    const content: Content = res.candidates?.[0]?.content ?? { role: "model", parts: [{ text: res.text ?? "" }] };
    s.history.push({ role: "model", parts: content.parts ?? [] });

    const calls = res.functionCalls ?? [];
    const text = (content.parts ?? []).map((p) => p.text ?? "").join("").trim();
    if (text) reply.text = reply.text ? `${reply.text}\n\n${text}` : text;
    if (!calls.length) break;

    const responses: Part[] = [];
    for (const call of calls) {
      const out = await runTool(s, call.name ?? "", (call.args ?? {}) as Record<string, unknown>);
      reply.stageEvents.push(...out.events);
      reply.attachments.push(...out.attachments);
      if (out.switchTo) pendingSwitch = out.switchTo;
      if (out.debateTopic) debateTopic = out.debateTopic;
      if (out.ended) reply.sessionEnded = true;
      responses.push({ functionResponse: { id: call.id, name: call.name, response: out.response } });
    }
    s.history.push({ role: "user", parts: responses });
  }

  if (debateTopic) {
    const debate = await runTextDebate(s, debateTopic);
    reply.text = [reply.text, debate.text].filter(Boolean).join("\n\n");
    reply.stageEvents.push(...debate.events);
    reply.character = "athena";
  } else if (pendingSwitch && pendingSwitch !== s.character) {
    reply.stageEvents.push({ type: "character", character: pendingSwitch });
    s.character = pendingSwitch;
    // The new character introduces itself in the same reply, with a recap instead of the old persona's history.
    const intro = await generate({
      contents: [{ role: "user", parts: [{ text: "(You have just been handed the conversation. Greet the user in one or two sentences and continue.)" }] }],
      config: { systemInstruction: systemPrompt(pendingSwitch, "text", { firstTurn: false, summary: recap(s) }), temperature: 0.8 },
    });
    const introText = intro.text?.trim();
    if (introText) {
      reply.text = `${reply.text}\n\n${getCharacter(pendingSwitch)?.name}: ${introText}`.trim();
      s.history.push({ role: "model", parts: [{ text: introText }] });
    }
    reply.character = pendingSwitch;
  }
  if (!reply.text) reply.text = "Tell me more, traveler.";
  // The ending must state Your Ithaca in words, not only on the card.
  const takeaway = s.summary.takeaway;
  if (reply.sessionEnded && takeaway && !reply.text.includes(takeaway.slice(0, 40))) reply.text = `Your Ithaca: ${takeaway}\n\n${reply.text}`;
  return dedupe(reply);
}

/** Odysseus (left) and Poseidon (right) trade short arguments, then Athena asks the user to pick a side. */
async function runTextDebate(s: Session, topic: string): Promise<{ text: string; events: StageEvent[] }> {
  const events: StageEvent[] = [];
  const lines: string[] = [];
  const turns: { who: CharacterId; side: "left" | "right" }[] = [
    { who: "odysseus", side: "left" }, { who: "poseidon", side: "right" },
    { who: "odysseus", side: "left" }, { who: "poseidon", side: "right" },
  ];
  for (const t of turns) {
    events.push({ type: "character", character: t.who, side: t.side });
    const res = await generate({
      contents: [{ role: "user", parts: [{ text: `Debate topic: ${topic}\n\nDebate so far:\n${lines.join("\n") || "(you open)"}\n\nGive your next argument in under 40 words. Answer your opponent directly. No quotes unless they appear above.` }] }],
      config: { systemInstruction: systemPrompt(t.who, "text", { firstTurn: false, summary: recap(s, 6) }), temperature: 0.9 },
    });
    const text = res.text?.trim() ?? "";
    lines.push(`${getCharacter(t.who)?.name}: ${text}`);
    s.transcript.push({ who: t.who, text });
  }
  events.push({ type: "character", character: "athena" });
  s.character = "athena";
  const closing = "Athena: You've heard them both. Whose side are you on, Odysseus or Poseidon? And why?";
  s.history.push({ role: "model", parts: [{ text: `[Debate]\n${lines.join("\n")}\n${closing}` }] });
  return { text: [...lines, closing].join("\n\n"), events };
}

function dedupe(r: TextReply): TextReply {
  const seen = new Set<string>();
  r.attachments = r.attachments.filter((a: Attachment) => !seen.has(a.url) && !!seen.add(a.url));
  return r;
}

// ---------------------------------------------------------------- offline (no API key)

const GREETING = /^(hi|hello|hey|yo|sup|hiya|good (morning|afternoon|evening)|start)\b[\s!.?]*$/i;
const GOODBYE = /\b(bye|goodbye|thanks|thank you|done|that'?s all|end|ithaca)\b/i;
const DEBATE = /\b(debate|both sides|argue)\b/i;

/** A scripted Athena that uses real retrieval, so the text path and stage work without Gemini. */
function offlineTurn(s: Session, message: string): TextReply {
  const base = { attachments: [] as Attachment[], stageEvents: [] as StageEvent[], sessionEnded: false };
  const ep = s.summary.episodeId ? getEpisode(s.summary.episodeId) : undefined;

  if (!s.summary.problem && GREETING.test(message.trim())) {
    return { ...base, character: "athena", stageEvents: [{ type: "character", character: "athena" }],
      text: "I'm an AI playing Athena, goddess of wisdom. Every great solution begins with an Odyssey. Tell me, traveler, what storm are you sailing through?" };
  }

  if (!s.summary.problem) {
    const [e] = findEpisode(message, 1);
    s.summary.problem = message.trim();
    s.summary.episodeId = e.id;
    const q = e.keyQuotes[0];
    s.summary.quote = q;
    return {
      ...base,
      character: "athena",
      attachments: [{ kind: "image", url: sceneUrl(e.sceneId), alt: e.title }],
      stageEvents: [
        { type: "character", character: "athena" },
        { type: "scene", sceneId: e.sceneId },
        { type: "map", locationId: e.locationId },
        { type: "highlight", passageIds: [q.passageId] },
      ],
      text: `That reminds me of ${e.title}. ${e.summary} As Homer tells it: "${q.text}" (${q.passageId}). ${e.lessons[0]} What would that look like in your life?`,
    };
  }

  if (ep && DEBATE.test(message)) {
    return {
      ...base,
      character: "athena",
      stageEvents: [
        { type: "character", character: "odysseus", side: "left" },
        { type: "character", character: "poseidon", side: "right" },
        { type: "character", character: "athena" },
      ],
      text: `Odysseus: ${ep.lessons[0]} I chose my own road and it brought me home.\n\nPoseidon: ${ep.lessons[1] ?? ep.lessons[0]} The sea punishes those who think they are cleverer than it.\n\nAthena: Whose side are you on?`,
    };
  }

  if (GOODBYE.test(message) || s.transcript.filter((t) => t.who === "user").length >= 4) {
    const e = ep ?? findEpisode(s.summary.problem, 1)[0];
    s.summary.lesson = e.lessons[0];
    // The user's own idea for a step is the best "action": their latest message that wasn't the problem,
    // a goodbye or a debate request.
    const idea = [...s.transcript].reverse().find((t) => t.who === "user" && t.text !== s.summary.problem &&
      t.text.length > 8 && !GOODBYE.test(t.text) && !DEBATE.test(t.text) && !GREETING.test(t.text));
    const action = idea ? idea.text.trim().replace(/^(maybe|i could|i guess|probably|i'll|i will)\s+/i, "").replace(/[.!]*$/, ".").replace(/\b(my|me|I'm|I)\b/g, (w) => ({ my: "your", me: "you", "I'm": "you're", I: "you" })[w] ?? w) : "take one small step toward your Ithaca.";
    s.summary.takeaway = `${e.lessons[0]} This week: ${action}`;
    s.summary.ended = true;
    return {
      ...base,
      character: "athena",
      sessionEnded: true,
      attachments: [{ kind: "image", url: cardUrl(s.id), alt: "Your Odyssey summary card" }],
      stageEvents: [{ type: "caption", text: `Your Ithaca: ${s.summary.takeaway}` }],
      text: `Your Ithaca: ${s.summary.takeaway} Safe voyage, traveler. Text me whenever the winds change.`,
    };
  }

  const e = ep ?? findEpisode(message, 1)[0];
  const q = e.keyQuotes.find((k) => k.text !== s.summary.quote?.text);
  return {
    ...base,
    character: "athena",
    stageEvents: q ? [{ type: "highlight", passageIds: [q.passageId] }] : [],
    text: `${e.lessons[1] ?? e.lessons[0]}${q ? ` Remember: "${q.text}" (${q.passageId}).` : ""} What is one small step you could take this week? Or say "debate" to hear Odysseus and Poseidon argue it out.`,
  };
}
