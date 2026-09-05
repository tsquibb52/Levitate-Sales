import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import { db, createDemo, transaction } from "../lib/db.ts";
import { blankDemo } from "../lib/fields.ts";
import { recoverUnlinkedDemos } from "../lib/recovery.ts";
const folder = path.join(process.cwd(), "Call Logs");
let calls = 0, bookings = 0;
transaction(() => {
  for (const file of readdirSync(folder).filter(f => f.toLowerCase().endsWith(".csv"))) {
    const parsed = Papa.parse<Record<string, string>>(readFileSync(path.join(folder, file), "utf8"), { header: true, skipEmptyLines: true });
    const fatal = parsed.errors.find(e => !(e.code === "TooFewFields" && e.row !== undefined && Object.keys(parsed.data[e.row]).length === 12));
    if (fatal) throw new Error(`Cannot read ${file}: ${fatal.message}`);
    for (const row of parsed.data) {
      if (!row.PhoneCallId) continue;
      calls += Number(db.prepare("INSERT OR IGNORE INTO calls (id, companyId, company, contact, calledAt, outcome, transcript, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(row.PhoneCallId, row.CompanyId || "", row.CompanyName || "", `${row.FirstName || ""} ${row.LastName || ""}`.trim(), row.CreationDate || "", row.Outcome || "", (row.Transcription || "").replace(/\\n/g, "\n"), file).changes);
      if (row.Outcome !== "Demo Booked!" || db.prepare("SELECT callId FROM seed_imports WHERE callId = ?").get(row.PhoneCallId)) continue;
      if (!db.prepare("SELECT id FROM demos WHERE phoneCallId = ?").get(row.PhoneCallId)) {
        createDemo({ ...blankDemo(), company: row.CompanyName, contact: `${row.FirstName || ""} ${row.LastName || ""}`.trim(), phone: row.PhoneNumber || "", companyId: row.CompanyId || "", phoneCallId: row.PhoneCallId,
          bookedDate: row.CreationDate.slice(0, 10), notes: "Imported from call logs. Review the booking transcript to add the scheduled date, CRM link, and meeting details." }, `Imported from ${file}`);
        bookings++;
      }
      db.prepare("INSERT INTO seed_imports (callId) VALUES (?)").run(row.PhoneCallId);
    }
  }
});
const recovered = recoverUnlinkedDemos();
console.log(`Imported ${bookings} bookings, recovered ${recovered} provisional demos from follow-ups, and imported ${calls} call logs. Existing records were preserved.`);
console.log("Call coverage is based on CSV CreationDate, not filenames:");
console.table(db.prepare("SELECT source, MIN(calledAt) AS firstCall, MAX(calledAt) AS lastCall, COUNT(*) AS calls FROM calls GROUP BY source").all());
