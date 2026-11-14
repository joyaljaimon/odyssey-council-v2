// GET /card?sessionId=... -> "Your Odyssey" summary card PNG (1080x1350) that Channel texts.
// TODO(experience): render with next/og (ImageResponse) using the session's episode, quote, lesson and takeaway.
export async function GET() {
  return new Response("summary card not implemented yet", { status: 501 });
}
