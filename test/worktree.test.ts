import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { resolveWorktreeSpec, sanitizeWorktreeKey, unscopedWorktreeKey } from "../src/worktree";

describe("worktree", () => {
  test("sanitizeWorktreeKey normalizes punctuation and spacing", () => {
    assert.equal(sanitizeWorktreeKey("  BRI 32 / Hot Fix  "), "bri-32-hot-fix");
  });

  test("resolveWorktreeSpec is deterministic for issue id", () => {
    const first = resolveWorktreeSpec("BRI-32", "2026-02-28T11:00:00.000Z", 100);
    const second = resolveWorktreeSpec("BRI-32", "2026-02-28T12:00:00.000Z", 200);
    assert.deepEqual(first, second);
    assert.equal(first.key, "bri-32");
    assert.equal(first.branch, "project-agent-bri-32");
  });

  test("resolveWorktreeSpec generates unique unscoped keys from time and pid", () => {
    const first = resolveWorktreeSpec("", "2026-02-28T11:00:00.000Z", 100);
    const second = resolveWorktreeSpec("", "2026-02-28T11:00:00.000Z", 101);
    assert.notEqual(first.key, second.key);
    assert.match(first.key, /^unscoped-2026-02-28t11-00-00-000z-p100$/);
    assert.equal(first.branch, `project-agent-${first.key}`);
  });

  test("unscopedWorktreeKey encodes timestamp and pid", () => {
    assert.equal(unscopedWorktreeKey("2026-02-28T11:00:00.000Z", 42), "unscoped-2026-02-28t11-00-00-000z-p42");
  });
});
