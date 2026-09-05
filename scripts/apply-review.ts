import { readFileSync } from "node:fs";
import { db, getDemo, updateDemo } from "../lib/db.ts";
import type { Call, Demo, DemoInput } from "../lib/fields.ts";

type Review = { key: string; callId: string; evidence: string; values: Partial<DemoInput>; expected?: Partial<DemoInput>; note: string };
const file = process.argv[2];
if (!file) throw new Error("Usage: npm run apply-review -- path/to/review.json. Keep private review files in data/.");
const reviews: Review[] = JSON.parse(readFileSync(file, "utf8"));
let applied = 0;
for (const review of reviews) {
  const marker = `review:${review.key}`;
  if (db.prepare("SELECT callId FROM seed_imports WHERE callId = ?").get(marker)) continue;
  const call = db.prepare("SELECT * FROM calls WHERE id = ?").get(review.callId) as Call | undefined;
  if (!call || !review.evidence || !call.transcript.includes(review.evidence)) throw new Error(`Evidence not found: ${review.key}`);
  const matches = db.prepare("SELECT * FROM demos WHERE (companyId <> '' AND companyId = ?) OR phoneCallId = ?").all(call.companyId, call.id) as unknown as Demo[];
  if (matches.length !== 1) throw new Error(`Review requires one unambiguous demo: ${review.key}`);
  const demo = getDemo(matches[0].id)!;
  for (const [key, expected] of Object.entries(review.expected || {})) {
    if (demo[key as keyof DemoInput] !== expected) throw new Error(`Record changed since review (${key}): ${review.key}`);
  }
  const note = `Transcript review (${call.calledAt}, ${call.outcome}; call ${call.id}): ${review.note}\nEvidence: ${review.evidence}`;
  updateDemo(demo.id, { ...review.values, notes: `${demo.notes}\n\n${note}`.trim() });
  db.prepare("INSERT INTO seed_imports (callId) VALUES (?)").run(marker);
  applied++;
}
console.log(`Applied ${applied} reviewed corrections. Previous values remain in demo history.`);
