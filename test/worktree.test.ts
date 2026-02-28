import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { resolveWorktreeSpec, sanitizeWorktreeKey, unscopedWorktreeKey } from "../src/worktree";

describe("worktree", () => {
  test("sanitizeWorktreeKey normalizes punctuation and spacing", () => {
    assert.equal(sanitizeWorktreeKey("  BRI 32 / Hot Fix  "), "bri-32-hot-fix");
  });

  test("resolveWorktreeSpec is deterministic for issue id", () => {
    const first = resolveWorktreeSpec("BRI-32");
    const second = resolveWorktreeSpec("BRI-32");
    assert.deepEqual(first, second);
    assert.equal(first.key, "bri-32");
    assert.equal(first.branch, "bri-32");
  });

  test("resolveWorktreeSpec uses provided unscoped key", () => {
    const spec = resolveWorktreeSpec("", "unscoped-abc123");
    assert.equal(spec.key, "unscoped-abc123");
    assert.equal(spec.branch, "project-agent-unscoped-abc123");
  });

  test("resolveWorktreeSpec rejects missing issue and unscoped key", () => {
    assert.throws(() => resolveWorktreeSpec(""), /requires issueId or unscopedKey/i);
  });

  test("unscopedWorktreeKey normalizes session ids", () => {
    assert.equal(unscopedWorktreeKey("550e8400-e29b-41d4-a716-446655440000"), "unscoped-550e8400-e29b-41d4-a716-446655440000");
  });
});
