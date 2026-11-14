// Checks the LiveKit keys: mints a token, joins a throwaway room, leaves. Prints no secrets.
// Run: npm run check:livekit -w channel
import { Room, dispose } from "@livekit/rtc-node";
import { mintTokens } from "./facetime.ts";

const room = new Room();
try {
  const tokens = await mintTokens(`odyssey-check-${Date.now()}`);
  await room.connect(process.env.LIVEKIT_URL!, tokens.agent, { autoSubscribe: false, dynacast: false });
  console.log(`✓ LiveKit OK: joined room "${room.name}" on ${new URL(process.env.LIVEKIT_URL!).host}`);
} catch (err) {
  console.error(`✗ LiveKit check failed: ${(err as Error).message}`);
  process.exitCode = 1;
} finally {
  await room.disconnect().catch(() => {});
  await dispose();
}
