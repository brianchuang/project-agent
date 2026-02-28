import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createInitialRunArtifact, validateRunArtifact } from "../src/workflowArtifacts";

describe("workflowArtifacts", () => {
  test("initial artifact starts in progress and does not require done gates", () => {
    const artifact = createInitialRunArtifact("AG-1", "2026-02-28T00:00:00.000Z");
    assert.equal(artifact.status, "in_progress");
    assert.deepEqual(validateRunArtifact(artifact), []);
  });

  test("in-progress artifact can start without issueId for intake triage", () => {
    const artifact = createInitialRunArtifact("", "2026-02-28T00:00:00.000Z");
    assert.equal(artifact.status, "in_progress");
    assert.deepEqual(validateRunArtifact(artifact), []);
  });

  test("done artifact requires linear evidence, tests, verification, and endedAt", () => {
    const artifact = createInitialRunArtifact("", "2026-02-28T00:00:00.000Z");
    artifact.status = "done";
    const errors = validateRunArtifact(artifact);
    assert.ok(errors.some((e) => e.includes("requires issueId")));
    assert.ok(errors.some((e) => e.includes("planCommentPosted")));
    assert.ok(errors.some((e) => e.includes("progressCommentPosted")));
    assert.ok(errors.some((e) => e.includes("doneCommentPosted")));
    assert.ok(errors.some((e) => e.includes("tests.results")));
    assert.ok(errors.some((e) => e.includes("verification")));
    assert.ok(errors.some((e) => e.includes("endedAt")));
  });

  test("done artifact passes when all gate fields are satisfied", () => {
    const artifact = createInitialRunArtifact("AG-1", "2026-02-28T00:00:00.000Z");
    artifact.status = "done";
    artifact.endedAt = "2026-02-28T01:00:00.000Z";
    artifact.summary = "Implemented acceptance criteria.";
    artifact.linear.planCommentPosted = true;
    artifact.linear.progressCommentPosted = true;
    artifact.linear.doneCommentPosted = true;
    artifact.tests.commands = ["npm test"];
    artifact.tests.results = [{ command: "npm test", exitCode: 0 }];
    artifact.verification = ["Open the updated flow and confirm behavior."];

    assert.deepEqual(validateRunArtifact(artifact), []);
  });

  test("blocked artifact requires blockers and endedAt", () => {
    const artifact = createInitialRunArtifact("AG-1", "2026-02-28T00:00:00.000Z");
    artifact.status = "blocked";
    assert.ok(validateRunArtifact(artifact).length > 0);

    artifact.blockers = ["Waiting for clarification on acceptance criteria."];
    artifact.endedAt = "2026-02-28T01:00:00.000Z";
    assert.deepEqual(validateRunArtifact(artifact), []);
  });
});
