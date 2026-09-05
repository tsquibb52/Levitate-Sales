import { db, createDemo, transaction } from "./db.ts";
import { blankDemo } from "./fields.ts";
import type { Call } from "./fields.ts";

// Follow-up calls can prove a demo existed even when its original booking export is absent.
// A recovery is provisional: repeated calls for one company may refer to multiple meetings.
export function recoverUnlinkedDemos() {
  return transaction(() => {
    const calls = db.prepare("SELECT * FROM calls WHERE outcome LIKE 'Demo%' ORDER BY calledAt, id").all() as unknown as Call[];
    const groups = new Map<string, Call[]>();
    for (const call of calls) {
      const key = call.companyId || call.id;
      groups.set(key, [...(groups.get(key) || []), call]);
    }
    let recovered = 0;
    for (const [key, events] of groups) {
      const marker = `recovery:${key}`;
      const first = events[0], last = events.at(-1)!;
      if (db.prepare("SELECT callId FROM seed_imports WHERE callId = ?").get(marker)) continue;
      if (db.prepare("SELECT id FROM demos WHERE (companyId <> '' AND companyId = ?) OR phoneCallId = ?").get(first.companyId, first.id)) continue;
      // Never restore a booking the user deliberately deleted.
      if (events.some(event => db.prepare("SELECT callId FROM seed_imports WHERE callId = ?").get(event.id))) continue;
      const status = last.outcome === "Demo Cancelled" ? "Cancelled" : "Unknown / Needs Update";
      createDemo({ ...blankDemo(), company: first.company, contact: events.find(e => e.contact)?.contact || "", companyId: first.companyId, phoneCallId: first.id, status,
        notes: `Recovered from demo follow-up calls; original booking date is unavailable. Latest call outcome: ${last.outcome} (${last.calledAt}). Review the attached calls for schedule and attendance. This provisional record groups follow-ups for this company; split it if they refer to separate demos. Phone call ID identifies the first available follow-up, not necessarily the booking.`
      }, `Recovered from ${first.source}: ${first.outcome}`);
      db.prepare("INSERT INTO seed_imports (callId) VALUES (?)").run(marker);
      recovered++;
    }
    return recovered;
  });
}
