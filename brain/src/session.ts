// Per-session memory (in process only, per the MVP: nothing is persisted).
import type { Content } from "@google/genai";
import type { CharacterId, SessionSummary } from "@odyssey/contracts";
import type { AdventureState } from "./adventure.ts";

export type Session = {
  id: string;
  character: CharacterId;
  history: Content[]; // text-mode conversation, Gemini format
  transcript: { who: CharacterId | "user"; text: string }[]; // both modes; used for handover summaries
  disclosed: boolean; // has the agent said it is an AI yet
  summary: SessionSummary;
  story?: { momentId?: string }; // Story Mode on when set
  adventure?: AdventureState; // Be Odysseus in progress
  lastActive: number;
};

const sessions = new Map<string, Session>();
const IDLE_MS = 2 * 60 * 60 * 1000; // forget sessions after 2 idle hours

export function getSession(id: string): Session {
  let s = sessions.get(id);
  if (!s || (s.summary.ended && Date.now() - s.lastActive > 10 * 60 * 1000)) {
    s = {
      id,
      character: "athena",
      history: [],
      transcript: [],
      disclosed: false,
      summary: { sessionId: id, character: "athena", ended: false },
      lastActive: Date.now(),
    };
    sessions.set(id, s);
  }
  s.lastActive = Date.now();
  return s;
}

export function peekSession(id: string): Session | undefined {
  return sessions.get(id);
}

export function resetSession(id: string) {
  sessions.delete(id);
}

/** Short plain-text recap for handing over to another character (Live sessions can't share history). */
export function recap(s: Session, maxTurns = 12): string {
  const lines = s.transcript.slice(-maxTurns).map((t) => `${t.who === "user" ? "User" : t.who}: ${t.text}`);
  const facts = [
    s.summary.problem && `User's problem: ${s.summary.problem}`,
    s.summary.episodeId && `Episode chosen: ${s.summary.episodeId}`,
    s.summary.quote && `Quote shown: (${s.summary.quote.passageId}) ${s.summary.quote.text}`,
  ].filter(Boolean);
  return [...facts, ...lines].join("\n");
}

setInterval(() => {
  const now = Date.now();
  for (const [id, s] of sessions) if (now - s.lastActive > IDLE_MS) sessions.delete(id);
}, 10 * 60 * 1000).unref();
