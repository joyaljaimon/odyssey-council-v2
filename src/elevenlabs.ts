// ElevenLabs voices (used first when ELEVENLABS_API_KEY is set; Gemini voices and the Mac's `say` are the fallbacks).
// Streams raw PCM16 mono 24 kHz, the same format as Gemini TTS, so the rest of the app doesn't care which one spoke.
// Each Council member gets a voice from the account's own voice list, chosen by name preference, then by gender/age,
// so it works with whatever voices a free account can use. Override one with ELEVEN_VOICE_<ID>=<voice id>.
import type { Member } from "./roster.ts";

const API = "https://api.elevenlabs.io/v1";
export const ELEVEN_KEY = process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY || "";
const MODEL = process.env.ELEVEN_MODEL ?? "eleven_flash_v2_5"; // fastest and cheapest per character

type Want = { gender: "male" | "female"; age: "young" | "middle" | "old"; names: string[] };
// First choices are ElevenLabs' default voices; anything missing falls back to gender + age.
const WANT: Record<string, Want> = {
  athena: { gender: "female", age: "middle", names: ["Alice", "Charlotte", "Sarah"] },
  odysseus: { gender: "male", age: "middle", names: ["George", "Brian", "Daniel"] },
  poseidon: { gender: "male", age: "middle", names: ["Callum", "Clyde", "Arnold"] },
  zeus: { gender: "male", age: "old", names: ["Bill", "Roger", "Brian"] },
  hermes: { gender: "male", age: "young", names: ["Liam", "Charlie", "Will"] },
  penelope: { gender: "female", age: "middle", names: ["Matilda", "Laura", "Sarah"] },
  telemachus: { gender: "male", age: "young", names: ["Will", "Liam", "Eric"] },
  circe: { gender: "female", age: "middle", names: ["Charlotte", "Jessica", "Alice"] },
  calypso: { gender: "female", age: "young", names: ["Lily", "Laura", "Aria"] },
  polyphemus: { gender: "male", age: "middle", names: ["Brian", "Clyde", "Arnold"] },
  tiresias: { gender: "male", age: "old", names: ["Roger", "Bill", "Daniel"] },
  eurylochus: { gender: "male", age: "middle", names: ["Chris", "Eric", "Charlie"] },
  antinous: { gender: "male", age: "young", names: ["Eric", "Daniel", "Chris"] },
  eumaeus: { gender: "male", age: "old", names: ["Roger", "Bill", "George"] },
  nausicaa: { gender: "female", age: "young", names: ["Jessica", "Aria", "Lily"] },
  helios: { gender: "male", age: "middle", names: ["Daniel", "Brian", "George"] },
};

type Voice = { voice_id: string; name: string; labels?: Record<string, string> };
// ElevenLabs' built-in default voices (same ids on every account). Used when the key can't list voices
// (no voices_read permission) or the list fails.
const DEFAULTS: Voice[] = ([
  ["Alice", "Xb7hH8MSUJpSbSDYk0k2", "female", "middle"], ["Aria", "9BWtsMINqrJLrRacOk9x", "female", "middle"],
  ["Bill", "pqHfZKP75CvOlQylNhV4", "male", "old"], ["Brian", "nPczCjzI2devNBz1zQrb", "male", "middle"],
  ["Callum", "N2lVS1w4EtoT3dr4eOWO", "male", "middle"], ["Charlie", "IKne3meq5aSn9XLyUdCD", "male", "young"],
  ["Charlotte", "XB0fDUnXU5powFXDhCwa", "female", "young"], ["Chris", "iP95p4xoKVk53GoZ742B", "male", "middle"],
  ["Daniel", "onwK4e9ZLuTAKqWW03F9", "male", "middle"], ["Eric", "cjVigY5qzO86Huf0OWal", "male", "middle"],
  ["George", "JBFqnCBsd6RMkjVDRZzb", "male", "middle"], ["Jessica", "cgSgspJ2msm6clMCkdW9", "female", "young"],
  ["Laura", "FGY2WhTYpPnrIDTdsKH5", "female", "young"], ["Liam", "TX3LPaxmHKxFdv7VOQHJ", "male", "young"],
  ["Lily", "pFZP5JQG7iQjIQuC4Bku", "female", "middle"], ["Matilda", "XrExE9yKIg1WjnnlVkGX", "female", "middle"],
  ["Roger", "CwhRBWXzGAHq8TQ4Fs17", "male", "middle"], ["Sarah", "EXAVITQu4vr4xnSDxMaL", "female", "young"],
  ["Will", "bIHbv24MWmeRgasZH58o", "male", "young"],
] as const).map(([name, voice_id, gender, age]) => ({ name, voice_id, labels: { gender, age } }));
let voices: Promise<Map<string, string>> | null = null;

/** member id -> voice id, built once from the account's voices. */
function voiceMap(): Promise<Map<string, string>> {
  voices ??= (async () => {
    let list = DEFAULTS;
    try {
      const res = await fetch(`${API}/voices`, { headers: { "xi-api-key": ELEVEN_KEY }, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) throw new Error(`${res.status} ${(await res.text()).slice(0, 120)}`);
      const mine = ((await res.json()) as { voices: Voice[] }).voices;
      if (mine.length) list = mine;
    } catch (err) {
      console.log(`[eleven] can't list this account's voices (${(err as Error).message.slice(0, 80)}); using the default voices`);
    }
    const used = new Map<string, number>();
    const map = new Map<string, string>();
    const first = (n: string) => n.split(/[\s-]/)[0].toLowerCase();
    for (const [id, w] of Object.entries(WANT)) {
      const override = process.env[`ELEVEN_VOICE_${id.toUpperCase()}`];
      if (override) { map.set(id, override); continue; }
      const score = (v: Voice) => {
        const l = v.labels ?? {};
        const nameRank = w.names.findIndex((n) => first(v.name) === n.toLowerCase());
        let s = nameRank >= 0 ? 100 - nameRank * 10 : 0;
        if (l.gender && l.gender.toLowerCase() === w.gender) s += 20; else if (l.gender) s -= 50;
        if (l.age && l.age.toLowerCase().includes(w.age)) s += 8;
        return s - (used.get(v.voice_id) ?? 0) * 200; // every member gets their own voice while any are left
      };
      const best = [...list].sort((a, b) => score(b) - score(a))[0];
      if (!best) continue;
      map.set(id, best.voice_id);
      used.set(best.voice_id, (used.get(best.voice_id) ?? 0) + 1);
    }
    const names = new Map(list.map((v) => [v.voice_id, v.name]));
    console.log(`[eleven] voices: ${[...map].map(([m, v]) => `${m}=${(names.get(v) ?? v).split(" ")[0]}`).join(", ")}`);
    return map;
  })();
  voices.catch(() => { voices = null; }); // try again next time
  return voices;
}

export class ElevenError extends Error {
  constructor(readonly status: number, body: string) { super(`ElevenLabs ${status}: ${body.slice(0, 160).replace(/\s+/g, " ")}`); }
}

/** Stream a line in the member's ElevenLabs voice: PCM16 mono 24 kHz chunks (even-length). */
export async function* elevenSpeak(text: string, m: Member, signal?: AbortSignal, firstMs = 4000): AsyncGenerator<Buffer> {
  const voice = (await voiceMap()).get(m.id);
  if (!voice) throw new ElevenError(404, `no voice for ${m.id}`);
  const ctrl = new AbortController();
  const stop = () => ctrl.abort();
  signal?.addEventListener("abort", stop);
  let timer: NodeJS.Timeout | undefined = setTimeout(stop, firstMs);
  try {
    const res = await fetch(`${API}/text-to-speech/${voice}/stream?output_format=pcm_24000&optimize_streaming_latency=3`, {
      method: "POST",
      headers: { "xi-api-key": ELEVEN_KEY, "content-type": "application/json", accept: "audio/pcm" },
      body: JSON.stringify({ text, model_id: MODEL, voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.25 } }),
      signal: ctrl.signal,
    });
    if (!res.ok || !res.body) throw new ElevenError(res.status, await res.text().catch(() => ""));
    let carry: Buffer | null = null;
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      if (timer) { clearTimeout(timer); timer = undefined; }
      let buf = Buffer.from(chunk);
      if (carry) { buf = Buffer.concat([carry, buf]); carry = null; }
      if (buf.length & 1) { carry = buf.subarray(buf.length - 1); buf = buf.subarray(0, buf.length - 1); }
      if (buf.length) yield buf;
    }
  } finally {
    if (timer) clearTimeout(timer);
    signal?.removeEventListener("abort", stop);
  }
}

/** Which provider spoke, for the voice cache (a greeting recorded in one voice must not play in another). */
export const voiceTag = (m: Member) => (ELEVEN_KEY ? `eleven-${m.id}` : `gemini-${m.voice}`);
