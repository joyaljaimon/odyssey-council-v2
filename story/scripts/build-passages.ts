// Builds data/passages.json from Samuel Butler's prose translation (Project Gutenberg #1727).
// Run: npm run download -w story && npm run build:passages -w story
import { readFileSync, writeFileSync } from "node:fs";
import type { Passage } from "@odyssey/contracts";

const raw = readFileSync(new URL("../raw/odyssey-butler.txt", import.meta.url), "utf8").replace(/\r\n/g, "\n");

// Strip the Gutenberg header/footer.
const start = raw.indexOf("*** START OF");
const end = raw.indexOf("*** END OF");
let body = raw.slice(raw.indexOf("\n", start) + 1, end === -1 ? undefined : end);
// Butler's endnotes follow Book XXIV; they are not part of the poem.
const notes = body.indexOf("\nFOOTNOTES:");
if (notes !== -1) body = body.slice(0, notes);

// Book headings in Gutenberg #1727 are a bare line "BOOK I" (the table of contents uses "BOOK I." with a
// leading space, which this regex skips). Each heading is followed by an all-caps subtitle we store separately.
const bookRe = /^BOOK ([IVXL]+)\s*$/gm;
const roman = (s: string) =>
  [...s].reduce((acc, ch, i, arr) => {
    const v = { I: 1, V: 5, X: 10, L: 50 }[ch as "I"]!;
    const next = { I: 1, V: 5, X: 10, L: 50 }[arr[i + 1] as "I"] ?? 0;
    return acc + (v < next ? -v : v);
  }, 0);

// Butler's footnote markers are bare numbers glued to the preceding word or punctuation ("directions100",
// "Sirens,102"). Remove them so quotes read cleanly. A few stand alone ("chest. 131 Then"). Butler spells out every real number, so any numeral is a marker.
const stripNotes = (p: string) => p.replace(/\[\d+\]/g, "").replace(/([A-Za-z,;:.!?’”—)\]])\d{1,3}(?=[\s,;:.!?’”—]|$)/g, "$1").replace(/\s\d{1,3}(?=[\s—]|$)/g, " ");

const marks = [...body.matchAll(bookRe)];
const passages: Passage[] = [];
marks.forEach((m, i) => {
  const book = roman(m[1]);
  const text = body.slice(m.index! + m[0].length, marks[i + 1]?.index ?? body.length);
  const paras = text
    .split(/\n\s*\n/)
    .map((p) => stripNotes(p).replace(/\s+/g, " ").trim())
    .filter((p) => p.length > 40) // drops short headings
    .filter((p) => p !== p.toUpperCase()); // drops the all-caps book subtitle
  paras.forEach((t, j) => passages.push({ id: `${book}.${j + 1}`, book, para: j + 1, text: t }));
});

// Book subtitles ("THE SIRENS, SCYLLA AND CHARYBDIS, ...") for display on the stage.
const titles: Record<number, string> = {};
marks.forEach((m, i) => {
  const text = body.slice(m.index! + m[0].length, marks[i + 1]?.index ?? body.length);
  const first = text.split(/\n\s*\n/).map((p) => p.replace(/\s+/g, " ").trim()).find((p) => p.length > 0) ?? "";
  if (first === first.toUpperCase()) titles[roman(m[1])] = first.replace(/\.$/, "");
});
writeFileSync(new URL("../data/book-titles.json", import.meta.url), JSON.stringify(titles, null, 2));

writeFileSync(new URL("../data/passages.json", import.meta.url), JSON.stringify(passages, null, 2));
console.log(`Wrote ${passages.length} passages across ${marks.length} books`);
