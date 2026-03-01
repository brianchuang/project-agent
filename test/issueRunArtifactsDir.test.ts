import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
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

test("issue-run unscoped instructions include PR lifecycle requirements", () => {
  const cwd = mkdtempSync(join(repoRoot, ".tmp-project-agent-unscoped-instructions-"));
  try {
    const run = spawnSync(process.execPath, ["--import", "tsx", scriptPath, "--no-codex"], {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        PROJECT_AGENT_DISABLE_WORKTREE: "1"
      }
    });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const instructionsPath = extractOutputPath(run.stdout || "", "- Instructions: ");
    const instructions = readFileSync(instructionsPath, "utf8");
    assert.match(
      instructions,
      /8\. PR lifecycle: open or update a PR for the issue branch and record the PR URL in run\.json changes\.pullRequestUrl\./
    );
    assert.match(
      instructions,
      /9\. Document: post progress \+ done comments with summary, tests, verification, and PR details\./
    );
    assert.match(instructions, /Run-local skills:/);
    assert.match(instructions, /- Linear workflow: .*\/skills\/linear\.md/);
    assert.match(instructions, /- GitHub workflow: .*\/skills\/github\.md/);
    assert.match(instructions, /- Skill manifest \(names \+ metadata\): .*\/skills\/skills\.json/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test("issue-run issue-bound instructions include PR lifecycle requirements", () => {
  const cwd = mkdtempSync(join(repoRoot, ".tmp-project-agent-issue-instructions-"));
  try {
    const run = spawnSync(process.execPath, ["--import", "tsx", scriptPath, "BRI-39", "--no-codex"], {
      cwd,
      encoding: "utf8",
      env: {
        ...process.env,
        PROJECT_AGENT_DISABLE_WORKTREE: "1"
      }
    });
    assert.equal(run.status, 0, run.stderr || run.stdout);
    const instructionsPath = extractOutputPath(run.stdout || "", "- Instructions: ");
    const instructions = readFileSync(instructionsPath, "utf8");
    assert.match(
      instructions,
      /6\. PR lifecycle: open or update a PR for the issue branch and record the PR URL in run\.json changes\.pullRequestUrl\./
    );
    assert.match(
      instructions,
      /7\. Document: post progress \+ done comments with summary, tests, verification, and PR details\./
    );
    const linearSkillPath = instructions
      .split("\n")
      .find((line) => line.startsWith("- Linear workflow: "))
      ?.slice("- Linear workflow: ".length)
      .trim();
    const githubSkillPath = instructions
      .split("\n")
      .find((line) => line.startsWith("- GitHub workflow: "))
      ?.slice("- GitHub workflow: ".length)
      .trim();
    const skillsManifestPath = instructions
      .split("\n")
      .find((line) => line.startsWith("- Skill manifest (names + metadata): "))
      ?.slice("- Skill manifest (names + metadata): ".length)
      .trim();
    assert.ok(linearSkillPath, "expected linear skill path in instructions");
    assert.ok(githubSkillPath, "expected github skill path in instructions");
    assert.ok(skillsManifestPath, "expected skills manifest path in instructions");
    const linearSkill = readFileSync(linearSkillPath!, "utf8");
    const githubSkill = readFileSync(githubSkillPath!, "utf8");
    const skillsManifest = JSON.parse(readFileSync(skillsManifestPath!, "utf8")) as {
      version: number;
      skills: Array<{ name: string; description: string; path: string }>;
    };
    assert.match(linearSkill, /# Run Skill: Linear Workflow/);
    assert.match(githubSkill, /# Run Skill: GitHub PR Workflow/);
    assert.match(linearSkill, /description: Run-scoped Linear workflow rules/);
    assert.match(githubSkill, /description: Run-scoped GitHub workflow rules/);
    assert.equal(skillsManifest.version, 1);
    assert.equal(skillsManifest.skills.length, 2);
    assert.equal(skillsManifest.skills[0]?.name, "linear-workflow");
    assert.equal(skillsManifest.skills[1]?.name, "github-pr-workflow");
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

function extractOutputPath(output: string, prefix: string): string {
  const line = output.split("\n").find((entry) => entry.startsWith(prefix));
  assert.ok(line, `expected output line with prefix ${prefix}`);
  return line!.slice(prefix.length).trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
