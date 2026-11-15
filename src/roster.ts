// The Council: everyone who can be called to speak. Each has a Gemini TTS voice, a macOS fallback voice, and a
// portrait in assets/portraits/<id>.jpg (+ <id>-speak.jpg, mouth open). Missing portraits fall back to a medallion.

export type Member = {
  id: string;
  name: string;
  title: string; // shown under the portrait
  voice: string; // Gemini TTS prebuilt voice
  sayVoice: string; // macOS `say` voice, used only if every Gemini TTS model fails
  style: string; // how they sound (fed to the TTS model as a style note)
  who: string; // for the script writer: who they are and what they stand for
};

export const ROSTER: Member[] = [
  { id: "athena", name: "Athena", title: "Goddess of wisdom", voice: "Kore", sayVoice: "Karen", style: "calm, clear and wise, with quiet warmth",
    who: "Goddess of wisdom and strategy, Odysseus' patron and the Council's chair. Values cunning, patience, self-control and courage. Fond of Odysseus, but blunt about his pride." },
  { id: "odysseus", name: "Odysseus", title: "King of Ithaca", voice: "Charon", sayVoice: "Daniel", style: "warm, weathered and wry, a storyteller",
    who: "The man of many turns. Lived every episode. Proud of his cunning, haunted by the men he lost, honest about his mistakes (the boast to the Cyclops, the delay with Circe)." },
  { id: "poseidon", name: "Poseidon", title: "Lord of the sea", voice: "Fenrir", sayVoice: "Ralph", style: "deep, booming and wrathful",
    who: "God of the sea, father of Polyphemus. Holds a grudge for ten years. Values honour, respect for the gods and vengeance; sees Odysseus as an arrogant thief." },
  { id: "zeus", name: "Zeus", title: "King of the gods", voice: "Alnilam", sayVoice: "Fred", style: "slow, grave and commanding",
    who: "King of the gods, keeper of xenia (guest-right) and justice. Says mortals blame the gods for their own folly (Book 1). Struck down the crew for eating Helios' cattle." },
  { id: "hermes", name: "Hermes", title: "Messenger of the gods", voice: "Puck", sayVoice: "Eddy (English (US))", style: "quick, playful and sly",
    who: "Messenger god and trickster. Ordered Calypso to free Odysseus; gave him the herb moly against Circe. Admires cleverness and crossing boundaries." },
  { id: "penelope", name: "Penelope", title: "Queen of Ithaca", voice: "Sulafat", sayVoice: "Moira", style: "measured, intelligent and guarded",
    who: "Odysseus' wife, as cunning as he is: unweaves Laertes' shroud each night for three years, tests Odysseus with the bed. Twenty years of waiting, holding a house of suitors at bay." },
  { id: "telemachus", name: "Telemachus", title: "Son of Odysseus", voice: "Achird", sayVoice: "Reed (English (US))", style: "young, earnest, finding his courage",
    who: "Grew up without his father. Goes from a powerless boy among the suitors to a man who stands beside Odysseus in the fight. About growing up and finding your voice." },
  { id: "circe", name: "Circe", title: "Enchantress of Aeaea", voice: "Despina", sayVoice: "Kathy", style: "silky, amused and knowing",
    who: "Witch-goddess who turned the crew into pigs, then became Odysseus' host and lover for a year, and finally gave him the honest directions home (Sirens, Scylla, the Underworld)." },
  { id: "calypso", name: "Calypso", title: "Nymph of Ogygia", voice: "Leda", sayVoice: "Flo (English (UK))", style: "soft, longing and bitter",
    who: "Held Odysseus seven years and offered him immortality; he chose to go home. Resents the gods' double standard for goddesses who love mortals (Book 5)." },
  { id: "polyphemus", name: "Polyphemus", title: "The Cyclops", voice: "Algenib", sayVoice: "Grandpa (English (UK))", style: "gravelly, slow and wounded",
    who: "One-eyed giant, son of Poseidon. Ate six of Odysseus' men, was blinded with a stake and tricked by the name 'Noman'. Cursed Odysseus once he learned his real name." },
  { id: "tiresias", name: "Tiresias", title: "The blind prophet", voice: "Enceladus", sayVoice: "Grandpa (English (US))", style: "hushed, breathy and otherworldly",
    who: "Dead prophet met in the Underworld (Book 11). Foretold the cattle of the Sun, the suitors, and Odysseus' last journey inland with an oar." },
  { id: "eurylochus", name: "Eurylochus", title: "Odysseus' second-in-command", voice: "Rasalgethi", sayVoice: "Fred", style: "tired, blunt and defiant",
    who: "Kinsman and officer. Escaped Circe's hall, later talked the starving crew into eating Helios' cattle: 'better to die at sea than starve'. Voice of the exhausted crew." },
  { id: "antinous", name: "Antinous", title: "Leader of the suitors", voice: "Sadaltager", sayVoice: "Reed (English (UK))", style: "arrogant, mocking and smooth",
    who: "The most insolent suitor: eats Odysseus' house bare, plots to kill Telemachus, throws a stool at the beggar. First to die by Odysseus' arrow (Book 22)." },
  { id: "eumaeus", name: "Eumaeus", title: "The loyal swineherd", voice: "Iapetus", sayVoice: "Daniel", style: "gentle, humble and steady",
    who: "Odysseus' swineherd, a model of xenia: welcomes the disguised beggar with his best. Loyal for twenty years; fights beside his master." },
  { id: "nausicaa", name: "Nausicaa", title: "Princess of the Phaeacians", voice: "Laomedeia", sayVoice: "Karen", style: "bright, kind and curious",
    who: "Phaeacian princess who finds Odysseus naked and shipwrecked on the shore and guides him to her parents' palace (Book 6). Grace, kindness to strangers." },
  { id: "helios", name: "Helios", title: "The Sun", voice: "Orus", sayVoice: "Ralph", style: "radiant, proud and severe",
    who: "The Sun, who sees everything. Demanded Zeus punish the crew for eating his sacred cattle, or he would shine among the dead." },
];

export const byId = new Map(ROSTER.map((m) => [m.id, m]));
const byName = new Map(ROSTER.map((m) => [m.name.toLowerCase(), m]));
const ALIASES: Record<string, string> = {
  ulysses: "odysseus", minerva: "athena", neptune: "poseidon", jove: "zeus", jupiter: "zeus", mercury: "hermes",
  cyclops: "polyphemus", "the cyclops": "polyphemus", teiresias: "tiresias", "the sun": "helios", nausikaa: "nausicaa",
};

/** Resolve whatever name the model wrote ("ATHENA", "Minerva", "The Cyclops") to a member, or undefined. */
export function findMember(raw: string): Member | undefined {
  const k = raw.trim().toLowerCase().replace(/[^a-z ]/g, "").trim();
  return byId.get(k) ?? byName.get(k) ?? byId.get(ALIASES[k] ?? "");
}

/** The Council's chair: greets, declines off-topic questions, and covers when something fails. */
export const CHAIR = byId.get("athena")!;
