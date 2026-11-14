// contract version: 1
// Shared shapes between Channel, Brain, Story and Stage.
// Announce any change in the team chat BEFORE merging, and bump the version above.

export type CharacterId = "athena" | "odysseus" | "poseidon" | "circe";

// ---- Brain text API: POST {BRAIN_URL}/text ----
export type TextRequest = {
  sessionId: string; // one per phone number per conversation
  from: string; // user's phone number or handle
  message: string;
  channel: "imessage" | "sms";
};

export type Attachment = { kind: "image"; url: string; alt: string };

export type TextReply = {
  character: CharacterId;
  text: string;
  attachments: Attachment[];
  stageEvents: StageEvent[]; // Channel can ignore these for text
  sessionEnded: boolean;
};

// ---- Brain voice socket: WS {BRAIN_URL}/voice?sessionId=... ----
// Channel -> Brain: binary frames, user audio, PCM16 mono 16 kHz
// Brain -> Channel: binary frames, character audio, PCM16 mono 24 kHz
export type VoiceControlMessage = { type: "interrupted" } | { type: "ended" };
export const USER_AUDIO_SAMPLE_RATE = 16000;
export const AGENT_AUDIO_SAMPLE_RATE = 24000;

// ---- Stage events: WS {BRAIN_URL}/stage?sessionId=... (Brain -> Stage) ----
export type StageEvent =
  | { type: "character"; character: CharacterId; side?: "left" | "right" }
  | { type: "mouth"; character: CharacterId; level: number } // 0..1, every ~50 ms
  | { type: "highlight"; passageIds: string[] } // e.g. ["12.14", "12.15"]
  | { type: "scene"; sceneId: string } // e.g. "sirens"
  | { type: "map"; locationId: string } // e.g. "aeaea"
  | { type: "caption"; text: string }
  | { type: "clear" };

// ---- Story data files (story/data/*.json) ----
export type Passage = { id: string; book: number; para: number; text: string };

export type Episode = {
  id: string;
  title: string;
  books: number[];
  passageIds: string[];
  summary: string;
  characters: CharacterId[];
  themes: string[];
  lessons: string[];
  problemTags: string[];
  keyQuotes: { passageId: string; text: string }[];
  sceneId: string;
  locationId: string;
};

export type Character = {
  id: CharacterId;
  name: string;
  bio: string;
  tone: string;
  speechRules: string[];
  sampleLines: string[];
  voice: string; // Gemini Live prebuilt voice name, chosen by Brain
};

// ---- Map locations (assets/map/locations.json) ----
export type MapLocation = { id: string; name: string; x: number; y: number }; // x, y in percent
