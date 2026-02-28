import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createInitialRunArtifact } from "../src/workflowArtifacts";
import { loadProjectConfig, resolveProjectNamespace } from "../src/projectConfig";
import { ensureIssueWorktreeAndMaybeRelaunch } from "../src/worktree";

function usage(): never {
  console.error("Usage: project-agent [ISSUE_ID] [--artifacts-dir <path>] [--no-codex]");
  process.exit(1);
}

const args = process.argv.slice(2);
let issueId = "";
let artifactsRootArg = "";
let noCodex = false;
for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (arg === "--no-codex") {
    noCodex = true;
    continue;
  }
  if (arg === "--artifacts-dir") {
    artifactsRootArg = (args[i + 1] || "").trim();
    if (!artifactsRootArg) {
      usage();
    }
    i += 1;
    continue;
  }
  if (arg.startsWith("--")) {
    usage();
  }
  if (!issueId) {
    issueId = arg.trim();
    continue;
  }
  usage();
}

function resolveArtifactsRoot(): string {
  if (artifactsRootArg) {
    return artifactsRootArg;
  }
  if (process.env.PROJECT_AGENT_ARTIFACTS_DIR?.trim()) {
    return process.env.PROJECT_AGENT_ARTIFACTS_DIR.trim();
  }
  return join(homedir(), ".project-agent-artifacts");
}

const root = process.cwd();
const worktreeBootstrap = ensureIssueWorktreeAndMaybeRelaunch({
  cwd: root,
  issueId
});
if (worktreeBootstrap.action === "relaunch") {
  console.log(`${worktreeBootstrap.created ? "Created" : "Reusing"} worktree ${worktreeBootstrap.path} (${worktreeBootstrap.branch}).`);
  const relaunchArgs = [...process.execArgv, process.argv[1], ...process.argv.slice(2)];
  const relaunch = spawnSync(process.execPath, relaunchArgs, {
    cwd: worktreeBootstrap.path,
    stdio: "inherit"
  });
  if (relaunch.error) {
    const code = (relaunch.error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      console.error("Failed to relaunch in worktree: node executable was not found.");
    } else {
      console.error(`Failed to relaunch in worktree: ${relaunch.error.message}`);
    }
    process.exit(1);
  }
  process.exit(typeof relaunch.status === "number" ? relaunch.status : 1);
}
if (worktreeBootstrap.action === "already-in-target") {
  console.log(`Using managed worktree ${worktreeBootstrap.path} (${worktreeBootstrap.branch}).`);
}
const effectiveRoot = process.cwd();
const loadedConfig = loadProjectConfig(effectiveRoot);
const runKey = issueId || `UNSCOPED-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const artifactDir = join(
  resolveArtifactsRoot(),
  resolveProjectNamespace(effectiveRoot, loadedConfig?.config ?? null),
  runKey
);
const runPath = join(artifactDir, "run.json");
const instructionsPath = join(artifactDir, "codex-instructions.md");

mkdirSync(artifactDir, { recursive: true });

const initial = createInitialRunArtifact(issueId);
try {
  readFileSync(runPath, "utf8");
} catch {
  writeFileSync(runPath, `${JSON.stringify(initial, null, 2)}\n`, "utf8");
}

const instructions = [
  `# Codex Run Contract: ${issueId || "No issue provided"}`,
  "",
  `Repository root: ${effectiveRoot}`,
  "",
  "Linear is the source of truth. Use Linear MCP tools for all issue actions.",
  loadedConfig
    ? `Default Linear project scope: ${loadedConfig.config.project}.`
    : "Default Linear scope: current team/workspace context (no project configured).",
  loadedConfig
    ? `Unless explicitly asked for team/workspace-wide status, query Linear with project="${loadedConfig.config.project}".`
    : "Unless explicitly asked for team/workspace-wide status, keep queries scoped to the relevant issue context.",
  "",
  "Required sequence:",
  issueId
    ? "1. Triage: ensure the issue exists and acceptance criteria are explicit."
    : "1. Wait gate: if no concrete user request exists yet, do not start intake triage.",
  issueId
    ? "2. Plan: post a plan comment to Linear before editing code."
    : "2. Intake triage: once a concrete user request exists, inspect it and search for an existing relevant issue in Linear.",
  issueId
    ? "3. Implement: make focused code changes against acceptance criteria."
    : "3. Bind before coding: once implementation scope is clear, reuse an existing issue when possible; create one only if truly needed, then set run.json issueId before edits.",
  issueId
    ? "4. Verify: run tests and collect concrete evidence."
    : "4. Plan: post a plan comment to that issue before editing code.",
  issueId
    ? "5. Document: post progress + done comments with summary, tests, verification, and PR details."
    : "5. Implement: make focused code changes against acceptance criteria.",
  issueId
    ? "6. Open or update a PR for the issue branch and capture the PR URL in run.json changes.pullRequestUrl."
    : "6. Verify: run tests and collect concrete evidence.",
  issueId
    ? "7. Transition: mark issue done only after evidence is posted."
    : "7. Document: post progress + done comments with summary, tests, verification.",
  issueId
    ? ""
    : "8. Transition: mark issue done only after evidence is posted.",
  "",
  "Artifact requirements:",
  "- Keep run.json in this directory updated during the run.",
  "- If run started without issueId, do not create placeholder issues; populate issueId only when implementation work is actually being started.",
  "- Set linear.planCommentPosted/progressCommentPosted/doneCommentPosted accurately.",
  "- Record test commands and results with exit codes.",
  "- For completed issue runs, set changes.pullRequestUrl to the opened/updated PR URL.",
  "- Do not set status=done unless tests are green and verification steps are present.",
  "",
  "Finish gate:",
  `- Run: npm run validate-run -- ${runPath}`,
  "- A run is complete only when validation passes."
].join("\n");

writeFileSync(instructionsPath, `${instructions}\n`, "utf8");

console.log(`Prepared run context for ${issueId || "unscoped intake"}.`);
console.log(`- Artifact: ${runPath}`);
console.log(`- Instructions: ${instructionsPath}`);
if (loadedConfig) {
  console.log(`- Project config: ${loadedConfig.path}`);
}

if (noCodex || process.env.PROJECT_AGENT_NO_CODEX === "1") {
  console.log("Next: open Codex for this repo and follow codex-instructions.md in the generated artifact directory.");
  process.exit(0);
}

console.log("Launching Codex for this repository...");
const initialPromptLines = [
  `Run context prepared. Read and follow: ${instructionsPath}`,
  loadedConfig
    ? `Default Linear project scope is "${loadedConfig.config.project}". Query this project unless user explicitly asks for team/workspace-wide scope.`
    : "Default Linear scope is the relevant issue context unless user explicitly asks for team/workspace-wide scope.",
  issueId
    ? `Issue ID for this run: ${issueId}`
    : "No issue ID provided yet; wait for the first concrete user request before intake triage. Do not create placeholder issues, and only bind run.json when implementation scope is confirmed."
];
const launch = spawnSync("codex", [initialPromptLines.join("\n")], { cwd: effectiveRoot, stdio: "inherit" });
if (launch.error) {
  const code = (launch.error as NodeJS.ErrnoException).code;
  if (code === "ENOENT") {
    console.error("Codex CLI was not found on PATH.");
  } else {
    console.error(`Failed to launch Codex: ${launch.error.message}`);
  }
  console.error(`Run Codex manually from ${effectiveRoot} and follow ${instructionsPath}.`);
  process.exit(1);
}
if (typeof launch.status === "number") {
  process.exit(launch.status);
}
