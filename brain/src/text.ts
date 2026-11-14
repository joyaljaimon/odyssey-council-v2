import type { TextReply, TextRequest } from "@odyssey/contracts";
import { findEpisode } from "@odyssey/story";
import { emit } from "./stage.ts";

// STUB. TODO(brain): call Gemini with the character's system prompt + tools from contracts/tools.json.
export async function handleText(req: TextRequest): Promise<TextReply> {
  const [episode] = findEpisode(req.message, 1);
  const reply: TextReply = {
    character: "athena",
    text: episode
      ? `I'm an AI playing Athena. What you describe reminds me of ${episode.title}. ${episode.lessons[0]}`
      : "I'm an AI playing Athena. Tell me, traveler, what storm are you sailing through?",
    attachments: episode
      ? [{ kind: "image", url: `${process.env.PUBLIC_BASE_URL ?? process.env.STAGE_URL ?? "http://localhost:3000"}/assets/scenes/${episode.sceneId}.png`, alt: episode.title }]
      : [],
    stageEvents: episode
      ? [
          { type: "character", character: "athena" },
          { type: "scene", sceneId: episode.sceneId },
          { type: "map", locationId: episode.locationId },
        ]
      : [],
    sessionEnded: false,
  };
  for (const e of reply.stageEvents) emit(req.sessionId, e);
  return reply;
}
