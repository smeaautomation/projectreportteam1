import assert from "node:assert/strict";
import test from "node:test";

import { MAX_SNAPSHOT_BYTES, SnapshotValidationError, validateSnapshot } from "../api/_snapshot.mjs";

function validProject(overrides = {}) {
  return {
    id: "project-1",
    name: "Project Satu",
    owner: "Dita",
    category: "Web Automation",
    start: "2026-11-01",
    end: "2026-11-30",
    urgency: "High",
    source: "Input dashboard",
    tasks: [
      {
        key: "task-1",
        name: "Aktivitas Satu",
        short: "Aktivitas",
        status: "active",
        context: "Konteks",
        startedAt: "2026-11-01",
        dueAt: "2026-11-15",
        completedAt: "",
      },
    ],
    ...overrides,
  };
}

test("returns a detached normalized snapshot while preserving array order", () => {
  const projects = [
    validProject(),
    validProject({ id: "project-2", name: "Project Dua", tasks: [] }),
  ];

  const result = validateSnapshot(projects);

  assert.deepEqual(result, projects);
  assert.notEqual(result, projects);
  assert.notEqual(result[0], projects[0]);
  assert.deepEqual(result.map((project) => project.id), ["project-1", "project-2"]);
});

test("rejects non-array snapshots and duplicate or missing IDs", () => {
  assert.throws(() => validateSnapshot({}), SnapshotValidationError);
  assert.throws(
    () => validateSnapshot([validProject(), validProject({ name: "Duplicate" })]),
    /duplicate project id/i,
  );
  assert.throws(() => validateSnapshot([validProject({ id: "" })]), /project id/i);
  assert.throws(
    () => validateSnapshot([validProject({ tasks: [validProject().tasks[0], validProject().tasks[0]] })]),
    /duplicate task key/i,
  );
});

test("rejects invalid task status and dates", () => {
  assert.throws(
    () => validateSnapshot([validProject({ tasks: [{ ...validProject().tasks[0], status: "blocked" }] })]),
    /task status/i,
  );
  assert.throws(() => validateSnapshot([validProject({ start: "01-11-2026" })]), /project start/i);
  assert.throws(
    () => validateSnapshot([validProject({ tasks: [{ ...validProject().tasks[0], dueAt: "2026-13-40" }] })]),
    /task dueAt/i,
  );
});

test("rejects strings beyond their field limits", () => {
  assert.throws(() => validateSnapshot([validProject({ name: "x".repeat(301) })]), /project name/i);
  assert.throws(
    () => validateSnapshot([validProject({ tasks: [{ ...validProject().tasks[0], context: "x".repeat(2001) }] })]),
    /context exceeds/i,
  );
});

test("rejects a serialized snapshot larger than the fixed one megabyte limit", () => {
  const tasks = Array.from({ length: 600 }, (_, index) => ({
    ...validProject().tasks[0],
    key: `task-${index}`,
    context: "x".repeat(1800),
  }));
  const projects = [validProject({ tasks })];

  assert.ok(Buffer.byteLength(JSON.stringify(projects)) > MAX_SNAPSHOT_BYTES);
  assert.throws(() => validateSnapshot(projects), /snapshot exceeds/i);
});
