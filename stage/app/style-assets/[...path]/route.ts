// GET /style-assets/<style>/<kind>/<file> -> a file from assets/styles/, read at request time.
// (Production Next.js only serves public/ files that existed at build time; style sets are generated later.)
import { readFile } from "node:fs/promises";
import { join, normalize, sep } from "node:path";

export const dynamic = "force-dynamic";
const ROOT = join(process.cwd(), "..", "assets", "styles");
const TYPES: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", json: "application/json" };

export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const rel = normalize((await params).path.join("/"));
  const file = join(ROOT, rel);
  if (!file.startsWith(ROOT + sep) || rel.includes("..")) return new Response("bad path", { status: 400 });
  const type = TYPES[rel.split(".").pop() ?? ""];
  if (!type) return new Response("not found", { status: 404 });
  try {
    const body = await readFile(file);
    return new Response(body, { headers: { "content-type": type, "cache-control": type === "application/json" ? "no-store" : "public, max-age=3600" } });
  } catch {
    return new Response("not found", { status: 404 });
  }
}
