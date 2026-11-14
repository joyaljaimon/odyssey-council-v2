// Builds data/passages.json from Samuel Butler's prose translation (Project Gutenberg #1727).
// Run: npm run download -w story && npm run build:passages -w story
import { readFileSync, writeFileSync } from "node:fs";
import type { Passage } from "@odyssey/contracts";

const raw = readFileSync(new URL("../raw/odyssey-butler.txt", import.meta.url), "utf8").replace(/\r\n/g, "\n");

// Strip the Gutenberg header/footer.
const start = raw.indexOf("*** START OF");
const end = raw.indexOf("*** END OF");
const body = raw.slice(raw.indexOf("\n", start) + 1, end === -1 ? undefined : end);

// TODO(story): check these against the actual file. Butler's books start with headings like "BOOK I".
const bookRe = /^BOOK ([IVXL]+)\s*$/gm;
const roman = (s: string) =>
  [...s].reduce((acc, ch, i, arr) => {
    const v = { I: 1, V: 5, X: 10, L: 50 }[ch as "I"]!;
    const next = { I: 1, V: 5, X: 10, L: 50 }[arr[i + 1] as "I"] ?? 0;
    return acc + (v < next ? -v : v);
  }, 0);

const marks = [...body.matchAll(bookRe)];
const passages: Passage[] = [];
marks.forEach((m, i) => {
  const book = roman(m[1]);
  const text = body.slice(m.index! + m[0].length, marks[i + 1]?.index ?? body.length);
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 40); // drops short headings / footnote markers
  paras.forEach((t, j) => passages.push({ id: `${book}.${j + 1}`, book, para: j + 1, text: t }));
});

writeFileSync(new URL("../data/passages.json", import.meta.url), JSON.stringify(passages, null, 2));
console.log(`Wrote ${passages.length} passages across ${marks.length} books`);
