import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { blankDemo, fields, statuses } from "./fields.ts";
import type { Demo, DemoInput, Call, History } from "./fields.ts";

const dbPath = process.env.DEMO_DB_PATH || path.join(process.cwd(), "data", "demos.sqlite");
mkdirSync(path.dirname(dbPath), { recursive: true });
export const db = new DatabaseSync(dbPath);
db.exec(`PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;
CREATE TABLE IF NOT EXISTS demos (
 id TEXT PRIMARY KEY,
 ${fields.map(([key]) => `"${key}" TEXT NOT NULL DEFAULT ''`).join(",\n")},
 createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS unique_call ON demos(phoneCallId) WHERE phoneCallId <> '';
CREATE INDEX IF NOT EXISTS demo_date ON demos(demoDate);
CREATE TABLE IF NOT EXISTS history (
 id INTEGER PRIMARY KEY, demoId TEXT NOT NULL REFERENCES demos(id) ON DELETE CASCADE,
 action TEXT NOT NULL, field TEXT, oldValue TEXT, newValue TEXT, createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS calls (
 id TEXT PRIMARY KEY, companyId TEXT NOT NULL, company TEXT NOT NULL, contact TEXT NOT NULL,
 calledAt TEXT NOT NULL, outcome TEXT NOT NULL, transcript TEXT NOT NULL, source TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS calls_company ON calls(companyId);
CREATE TABLE IF NOT EXISTS seed_imports (callId TEXT PRIMARY KEY);
`);
export function transaction<T>(fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try { const result = fn(); db.exec("COMMIT"); return result; } catch (error) { db.exec("ROLLBACK"); throw error; }
}
export function validate(input: unknown): DemoInput {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Invalid demo record.");
  const raw = input as Record<string, unknown>;
  const demo = blankDemo();
  for (const [key] of fields) {
    if (raw[key] !== undefined && typeof raw[key] !== "string") throw new Error(`Invalid ${key}.`);
    demo[key] = (raw[key] as string ?? demo[key]).trim();
    if (demo[key].length > 100000) throw new Error(`${key} is too long.`);
  }
  if (!demo.company) throw new Error("Company name is required.");
  if (!(statuses as readonly string[]).includes(demo.status)) throw new Error("Choose a valid status.");
  for (const key of ["bookedDate", "demoDate"] as const) {
    if (demo[key] && (!/^\d{4}-\d{2}-\d{2}$/.test(demo[key]) || !Number.isFinite(Date.parse(demo[key])) || new Date(demo[key]).toISOString().slice(0,10) !== demo[key])) throw new Error(`Invalid ${key}.`);
  }
  if (demo.demoTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(demo.demoTime)) throw new Error("Invalid demo time.");
  for (const key of ["website", "crmLink"] as const) {
    if (demo[key]) { try { if (!["http:", "https:"].includes(new URL(demo[key]).protocol)) throw new Error(); } catch { throw new Error(`${key} must start with https:// or http://.`); } }
  }
  return demo;
}
export function listDemos(): Demo[] { return db.prepare("SELECT * FROM demos ORDER BY bookedDate DESC, createdAt DESC").all() as unknown as Demo[]; }
export function getDemo(id: string) { return db.prepare("SELECT * FROM demos WHERE id = ?").get(id) as Demo | undefined; }
function history(id: string, action: string, field: string | null = null, oldValue: string | null = null, newValue: string | null = null) {
  db.prepare("INSERT INTO history (demoId, action, field, oldValue, newValue, createdAt) VALUES (?, ?, ?, ?, ?, ?)").run(id, action, field, oldValue, newValue, new Date().toISOString());
}
export function createDemo(input: unknown, action = "Demo created"): Demo {
  const value = validate(input), id = randomUUID(), now = new Date().toISOString();
  if (value.phoneCallId && db.prepare("SELECT id FROM demos WHERE phoneCallId = ?").get(value.phoneCallId)) throw new Error("This phone call ID already belongs to a demo.");
  db.prepare(`INSERT INTO demos (id, ${fields.map(([k]) => `"${k}"`).join(",")}, createdAt, updatedAt) VALUES (${Array(fields.length + 3).fill("?").join(",")})`).run(id, ...fields.map(([k]) => value[k]), now, now);
  history(id, action);
  return getDemo(id)!;
}
export function updateDemo(id: string, input: unknown) {
  return transaction(() => {
    const old = getDemo(id); if (!old) throw new Error("Demo not found.");
    const value = validate({ ...old, ...(input as object) });
    if (value.phoneCallId && db.prepare("SELECT id FROM demos WHERE phoneCallId = ? AND id <> ?").get(value.phoneCallId, id)) throw new Error("This phone call ID already belongs to a demo.");
    const changed = fields.filter(([key]) => old[key] !== value[key]);
    if (!changed.length) return old;
    db.prepare(`UPDATE demos SET ${fields.map(([k]) => `"${k}" = ?`).join(",")}, updatedAt = ? WHERE id = ?`).run(...fields.map(([k]) => value[k]), new Date().toISOString(), id);
    for (const [key, label] of changed) history(id, `${label} changed`, key, old[key], value[key]);
    return getDemo(id)!;
  });
}
export function deleteDemo(id: string) { return db.prepare("DELETE FROM demos WHERE id = ?").run(id).changes; }
export function detail(id: string) {
  const demo = getDemo(id); if (!demo) return null;
  return { demo, history: db.prepare("SELECT * FROM history WHERE demoId = ? ORDER BY id DESC").all(id) as unknown as History[],
    calls: db.prepare("SELECT * FROM calls WHERE (companyId <> '' AND companyId = ?) OR id = ? ORDER BY calledAt DESC").all(demo.companyId, demo.phoneCallId) as unknown as Call[] };
}
export function possibleDuplicate(value: DemoInput, existing: DemoInput[]) {
  return existing.some(d => (value.phoneCallId && d.phoneCallId === value.phoneCallId) ||
    (value.demoDate && value.contact && d.company.toLowerCase() === value.company.toLowerCase() && d.contact.toLowerCase() === value.contact.toLowerCase() && d.demoDate === value.demoDate));
}
