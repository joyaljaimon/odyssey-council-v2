// GET /passages/12 -> the passages of one book, so the stage loads text per book instead of bundling all 1,027.
import type { Passage } from "@odyssey/contracts";
import passagesJson from "@odyssey/story/data/passages.json";

const passages = passagesJson as Passage[];
export const dynamic = "force-static";
export const generateStaticParams = () => Array.from({ length: 24 }, (_, i) => ({ book: String(i + 1) }));

export async function GET(_req: Request, { params }: { params: Promise<{ book: string }> }) {
  const book = Number((await params).book);
  return Response.json(passages.filter((p) => p.book === book), { headers: { "cache-control": "public, max-age=31536000, immutable" } });
}
