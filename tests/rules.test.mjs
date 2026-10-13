import test from "node:test";
import assert from "node:assert/strict";
import {
  canManage,
  canAccount,
  canTeam,
  nextStatuses,
  inPeriod,
} from "../lib/rules.mjs";
test("Role boundaries", () => {
  assert.equal(canManage("Guide"), false);
  assert.equal(canManage("Accounting"), false);
  assert.equal(canAccount("Operations"), false);
  assert.equal(canTeam("Operations"), false);
  assert.equal(canTeam("Admin"), true);
  assert.equal(canManage("Owner"), true);
});
test("Lifecycle never reopens terminal tours", () => {
  assert.deepEqual(nextStatuses("Completed"), []);
  assert.deepEqual(nextStatuses("Cancelled"), []);
  assert.deepEqual(nextStatuses("Draft"), ["Planned", "Cancelled"]);
  assert.deepEqual(nextStatuses("Ongoing"), ["Completed", "Cancelled"]);
});
test("Weekly view uses Monday through Sunday", () => {
  assert.equal(inPeriod("2026-10-12", "Weekly", "2026-10-15"), true);
  assert.equal(inPeriod("2026-10-18", "Weekly", "2026-10-15"), true);
  assert.equal(inPeriod("2026-10-11", "Weekly", "2026-10-15"), false);
  assert.equal(inPeriod("2026-10-19", "Weekly", "2026-10-15"), false);
});
test("Reporting periods cross calendar boundaries", () => {
  assert.equal(inPeriod("2026-09-30", "Monthly", "2026-10-01"), false);
  assert.equal(inPeriod("2026-10-01", "Daily", "2026-10-01"), true);
  assert.equal(inPeriod("2025-12-31", "Yearly", "2026-01-01"), false);
  assert.equal(inPeriod("2026-01-01", "By Tour", "2026-10-01"), true);
});
