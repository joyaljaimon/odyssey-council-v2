One file per character (`athena.md`, `odysseus.md`, `poseidon.md`, `circe.md`) with that character's job in the
conversation. [../persona.ts](../persona.ts) combines it with the character's bio, tone, speech rules and sample
lines from `story/data/characters.json`, the shared rules (AI disclosure, short turns, cite `book.paragraph`, quote
only from tool results) and the list of episodes with their scene and location ids.
