import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const scriptPath = resolve(import.meta.dirname, "..", "scripts", "issue-run.ts");
const repoRoot = resolve(import.meta.dirname, "..");

test("issue-run defaults artifacts root to cwd and preserves override precedence", () => {
  const cwd = mkdtempSync(join(repoRoot, ".tmp-project-agent-artifacts-"));
  try {
    const defaultRun = spawnSync(process.execPath, ["--import", "tsx", scriptPath, "--no-codex"], {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        PROJECT_AGENT_DISABLE_WORKTREE: "1"
      }
    });
    assert.equal(defaultRun.status, 0, defaultRun.stderr || defaultRun.stdout);
    const defaultArtifactLine = (defaultRun.stdout || "")
      .split("\n")
      .find((line) => line.startsWith("- Artifact: "));
    assert.ok(defaultArtifactLine, "expected artifact path line in output");
    const defaultArtifactPath = defaultArtifactLine!.slice("- Artifact: ".length).trim();
    assert.match(defaultArtifactPath, new RegExp(`^${escapeRegExp(join(cwd, ".project-agent-artifacts"))}`));

    const envRoot = join(cwd, "env-root");
    const envRun = spawnSync(process.execPath, ["--import", "tsx", scriptPath, "--no-codex"], {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        PROJECT_AGENT_DISABLE_WORKTREE: "1",
        PROJECT_AGENT_ARTIFACTS_DIR: envRoot
      }
    });
    assert.equal(envRun.status, 0, envRun.stderr || envRun.stdout);
    const envArtifactLine = (envRun.stdout || "")
      .split("\n")
      .find((line) => line.startsWith("- Artifact: "));
    assert.ok(envArtifactLine, "expected artifact path line for env override");
    const envArtifactPath = envArtifactLine!.slice("- Artifact: ".length).trim();
    assert.match(envArtifactPath, new RegExp(`^${escapeRegExp(envRoot)}`));

    const cliRoot = join(cwd, "cli-root");
    const cliRun = spawnSync(
      process.execPath,
      ["--import", "tsx", scriptPath, "--artifacts-dir", cliRoot, "--no-codex"],
      {
        cwd,
        encoding: "utf8",
        env: {
          ...process.env,
          PROJECT_AGENT_DISABLE_WORKTREE: "1",
          PROJECT_AGENT_ARTIFACTS_DIR: envRoot
        }
      }
    );
    assert.equal(cliRun.status, 0, cliRun.stderr || cliRun.stdout);
    const cliArtifactLine = (cliRun.stdout || "")
      .split("\n")
      .find((line) => line.startsWith("- Artifact: "));
    assert.ok(cliArtifactLine, "expected artifact path line for CLI override");
    const cliArtifactPath = cliArtifactLine!.slice("- Artifact: ".length).trim();
    assert.match(cliArtifactPath, new RegExp(`^${escapeRegExp(cliRoot)}`));
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
