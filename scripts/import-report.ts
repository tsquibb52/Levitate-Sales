import { readFileSync } from "node:fs";
import { createDemo, db, listDemos, updateDemo } from "../lib/db.ts";
import { blankDemo } from "../lib/fields.ts";
import type { Demo, DemoInput } from "../lib/fields.ts";

type ReportRow = { company: string; phone: string; bookedDate: string; outcome: string };

const file = process.argv[2];
if (!file) throw new Error("Usage: npm run import-report -- path/to/export-report.txt");

const statusFromOutcome = (outcome: string) => outcome === "Demo Rescheduled!" ? "Rescheduled" : "Unknown / Needs Update";
const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
const coffeeLink = (companyId: string) => `https://secure.coffee.inc/#/queue?from=CallLog&companyId=${encodeURIComponent(companyId)}`;

function parseDate(value: string) {
  const match = value.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),\s+(\d{2})\/(\d{2})\/(\d{2}),/);
  if (!match) throw new Error(`Cannot parse report date: ${value}`);
  return `20${match[3]}-${match[1]}-${match[2]}`;
}

function parseReport(text: string) {
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const rows: ReportRow[] = [];
  for (let index = lines.indexOf("Recording Category") + 1; index < lines.length;) {
    const company = lines[index++];
    const phone = lines[index++];
    const sdr = lines[index++];
    const time = lines[index++];
    const outcome = lines[index++];
    index++;
    if (!company || !phone || !sdr || !time || !outcome) break;
    if (!outcome.startsWith("Demo ")) continue;
    rows.push({ company, phone, bookedDate: parseDate(time), outcome });
  }
  return rows;
}

function groupLatest(rows: ReportRow[]) {
  const grouped = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const key = normalize(row.company);
    grouped.set(key, [...(grouped.get(key) || []), row]);
  }
  return [...grouped.values()].map(events => {
    const booked = events.find(event => event.outcome === "Demo Booked!");
    const latest = events.at(0)!;
    return { ...latest, bookedDate: booked?.bookedDate || latest.bookedDate };
  });
}

function mergeValues(demo: Demo, row: ReportRow): Partial<DemoInput> {
  const values: Partial<DemoInput> = {};
  if (row.phone && demo.phone !== row.phone) values.phone = row.phone;
  if (!demo.bookedDate) values.bookedDate = row.bookedDate;
  if (!demo.crmLink && demo.companyId) values.crmLink = coffeeLink(demo.companyId);
  return values;
}

const rows = groupLatest(parseReport(readFileSync(file, "utf8")));
let created = 0, updated = 0;
for (const row of rows) {
  const existing = listDemos().find(demo => normalize(demo.company) === normalize(row.company));
  if (existing) {
    const values = mergeValues(existing, row);
    if (Object.keys(values).length) {
      updateDemo(existing.id, { ...values, notes: `${existing.notes}\n\nUpdated from pasted export report (${row.bookedDate}, ${row.outcome}).`.trim() });
      updated++;
    }
    continue;
  }
  createDemo({
    ...blankDemo(),
    company: row.company,
    phone: row.phone,
    bookedDate: row.bookedDate,
    status: statusFromOutcome(row.outcome),
    notes: `Created from pasted export report (${row.bookedDate}, ${row.outcome}). Add Coffee company ID when available to generate the lead link.`
  }, "Created from pasted export report");
  created++;
}

const linkUpdates = (db.prepare("SELECT * FROM demos WHERE companyId <> '' AND crmLink = ''").all() as Demo[]);
for (const demo of linkUpdates) {
  updateDemo(demo.id, { crmLink: coffeeLink(demo.companyId) });
  updated++;
}

console.log(`Imported report: created ${created}, updated ${updated}, parsed ${rows.length} companies.`);
