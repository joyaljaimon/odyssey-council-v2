// The art style all stages show. "vector" = the original drawn art; any folder in assets/styles/ with a
// manifest.json is an AI style (made by assets/tools/style-sets.mjs). Chosen on the stage's /styles page.
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";

const dir = new URL("../../assets/styles/", import.meta.url).pathname;
const file = `${dir}current.json`;

export function availableStyles(): string[] {
  const ai = existsSync(dir) ? readdirSync(dir).filter((d) => existsSync(`${dir}${d}/manifest.json`)) : [];
  return ["vector", ...ai];
}

let current: string = (() => {
  try { return JSON.parse(readFileSync(file, "utf8")).style ?? "vector"; } catch { return "vector"; }
})();

export const currentStyle = () => current;

export function setStyle(style: string): boolean {
  if (!availableStyles().includes(style)) return false;
  current = style;
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify({ style, at: new Date().toISOString() }, null, 2));
  return true;
}
