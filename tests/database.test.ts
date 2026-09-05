import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { blankDemo, metrics } from "../lib/fields.ts";
const directory = mkdtempSync(path.join(tmpdir(), "demo-tracker-test-"));
process.env.DEMO_DB_PATH = path.join(directory, "test.sqlite");
const { db, transaction, createDemo, updateDemo, detail, listDemos, deleteDemo, possibleDuplicate, validate } = await import("../lib/db.ts");
after(() => { db.close(); rmSync(directory, { recursive: true, force: true }); });
test("persists edits and preserves original schedule in history", () => {
  const demo = transaction(() => createDemo({ ...blankDemo(), company: "Test Company", demoDate: "2026-01-02", status: "Upcoming" }));
  updateDemo(demo.id, { demoDate: "2026-01-08", status: "Rescheduled", notes: "New appointment" });
  const record = detail(demo.id)!;
  assert.equal(record.demo.demoDate, "2026-01-08");
  assert.equal(record.history.find(h => h.field === "demoDate")?.oldValue, "2026-01-02");
  assert.equal(record.history.find(h => h.field === "status")?.newValue, "Rescheduled");
  assert.equal(record.history.length, 4);
  deleteDemo(demo.id);
  assert.equal(detail(demo.id), null);
  assert.equal(db.prepare("SELECT COUNT(*) AS total FROM history WHERE demoId = ?").get(demo.id)?.total, 0);
});
test("same company can book again; exact call IDs cannot repeat", () => {
  const input = { ...blankDemo(), company: "Repeat Company", contact: "Sam", phoneCallId: "call-1", demoDate: "2026-01-01" };
  transaction(() => createDemo(input));
  assert.equal(possibleDuplicate({ ...input, phoneCallId: "call-2", demoDate: "2026-02-01" }, listDemos()), false);
  assert.equal(possibleDuplicate({ ...input, phoneCallId: "" }, listDemos()), true);
  assert.throws(() => transaction(() => createDemo(input)), /already belongs/);
  assert.equal(listDemos().filter(d => d.company === input.company).length, 1);
});
test("failed batch imports roll back all inserted rows", () => {
  const before = listDemos().length;
  assert.throws(() => transaction(() => { createDemo({ ...blankDemo(), company: "Rollback" }); createDemo({ ...blankDemo(), company: "" }); }));
  assert.equal(listDemos().length, before);
});
test("validates calendar dates, status and URL schemes", () => {
  for (const extra of [{ demoDate: "2026-02-30" }, { status: "Anything" }, { crmLink: "javascript:alert(1)" }, { demoTime: "28:00" }]) {
    assert.throws(() => validate({ ...blankDemo(), company: "Validation", ...extra }));
  }
});
test("show rate excludes future demos and unknown outcomes", () => {
  const base = { ...blankDemo(), id: "test", company: "Metrics", createdAt: "", updatedAt: "" };
  const result = metrics([
    { ...base, status: "Showed", demoDate: "2020-01-01" },
    { ...base, status: "No Show", demoDate: "2020-01-01" },
    { ...base, status: "Showed", demoDate: "2099-01-01" },
    { ...base, status: "Upcoming", demoDate: "2099-01-01" },
    { ...base, status: "Unknown / Needs Update" }
  ]);
  assert.equal(result.showRate, 50); assert.equal(result.upcoming, 1); assert.equal(result.needsUpdate, 1);
});
