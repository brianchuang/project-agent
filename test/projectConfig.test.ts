import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { loadProjectConfig, parseProjectConfig, resolveProjectNamespace, sanitizeProjectName } from "../src/projectConfig";

describe("projectConfig", () => {
  test("loadProjectConfig returns null when no config file exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "project-agent-test-"));
    assert.equal(loadProjectConfig(dir), null);
  });

  test("loadProjectConfig reads project-agent.json when present", () => {
    const dir = mkdtempSync(join(tmpdir(), "project-agent-test-"));
    writeFileSync(join(dir, "project-agent.json"), JSON.stringify({ project: "My App" }));

    const loaded = loadProjectConfig(dir);
    assert.ok(loaded);
    assert.equal(loaded.path, join(dir, "project-agent.json"));
    assert.equal(loaded.config.project, "My App");
  });

  test("loadProjectConfig falls back to .project-agent.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "project-agent-test-"));
    writeFileSync(join(dir, ".project-agent.json"), JSON.stringify({ project: "Hidden Config App" }));

    const loaded = loadProjectConfig(dir);
    assert.ok(loaded);
    assert.equal(loaded.path, join(dir, ".project-agent.json"));
    assert.equal(loaded.config.project, "Hidden Config App");
  });

  test("loadProjectConfig throws actionable error for invalid JSON", () => {
    const dir = mkdtempSync(join(tmpdir(), "project-agent-test-"));
    writeFileSync(join(dir, "project-agent.json"), "{");

    assert.throws(
      () => loadProjectConfig(dir),
      /Invalid project config .*JSON parse failed/
    );
  });

  test("parseProjectConfig validates required project field", () => {
    assert.throws(
      () => parseProjectConfig(JSON.stringify({ project: "" }), "/tmp/project-agent.json"),
      /"project" must be a non-empty string/
    );
  });

  test("resolveProjectNamespace uses config project when provided", () => {
    const namespace = resolveProjectNamespace("/repo/path", { project: "My Project" });
    assert.equal(namespace, "my-project");
  });

  test("resolveProjectNamespace falls back to repo hash naming when no config is provided", () => {
    const namespace = resolveProjectNamespace("/repo/path", null);
    assert.match(namespace, /^path-[a-f0-9]{10}$/);
  });

  test("sanitizeProjectName normalizes punctuation and whitespace", () => {
    assert.equal(sanitizeProjectName("  Product Team / API  "), "product-team-api");
  });
});
