// Ends calls Chert still thinks are in progress (a "stuck" line that says it is busy / in a call).
// Needs CHERT_API_KEY (project key with facetime:read + facetime:write) and CHERT_PROJECT_ID in .env.
// Run: npm run end-calls            (lists open calls and ends them)
import { randomUUID } from "node:crypto";

const API = process.env.CHERT_FACETIME_API ?? "https://facetime.trychert.com/api";
const KEY = process.env.CHERT_API_KEY, PROJECT = process.env.CHERT_PROJECT_ID;
if (!KEY || !PROJECT) { console.error("Set CHERT_API_KEY and CHERT_PROJECT_ID in .env (app.trychert.com > Developer > new key with facetime:read and facetime:write)."); process.exit(2); }
const headers = { authorization: `Bearer ${KEY}`, "x-chert-project-id": PROJECT, "content-type": "application/json" };

const res = await fetch(`${API}/v1/calls`, { headers });
if (!res.ok) { console.error(`list calls: ${res.status} ${(await res.text()).slice(0, 300)}`); process.exit(1); }
const body = (await res.json()) as any;
const calls = (body.data ?? body.calls ?? []) as { id: string; status?: string; created_at?: string }[];
const DONE = /ended|completed|failed|canceled|cancelled|rejected|declined|expired/i;
const open = calls.filter((c) => !DONE.test(String(c.status ?? "")));
console.log(`${calls.length} recent calls, ${open.length} still open`);
for (const c of open) {
  const r = await fetch(`${API}/v1/calls/${c.id}/end`, { method: "POST", headers: { ...headers, "idempotency-key": `end-${randomUUID()}` }, body: "{}" });
  console.log(`  ${c.id} (${c.status}, ${c.created_at ?? ""}): end -> ${r.status} ${r.ok ? "" : (await r.text()).slice(0, 200)}`);
}
