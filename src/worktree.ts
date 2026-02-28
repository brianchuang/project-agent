import { existsSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const BOOTSTRAP_GUARD_ENV = "PROJECT_AGENT_WORKTREE_BOOTSTRAPPED";
const DISABLE_WORKTREE_ENV = "PROJECT_AGENT_DISABLE_WORKTREE";
const WORKTREE_DIRNAME = ".project-agent-worktrees";

export type WorktreeSpec = {
  key: string;
  branch: string;
};

export type WorktreeBootstrapResult =
  | { action: "skipped"; reason: string }
  | { action: "already-in-target"; path: string; branch: string }
  | { action: "relaunch"; path: string; branch: string; created: boolean };

export function sanitizeWorktreeKey(value: string): string {
  const cleaned = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "run";
}

export function unscopedWorktreeKey(nowIso: string, pid: number): string {
  const ts = nowIso.replace(/[:.]/g, "-").toLowerCase();
  return sanitizeWorktreeKey(`unscoped-${ts}-p${pid}`);
}

export function resolveWorktreeSpec(issueId: string, nowIso: string, pid: number): WorktreeSpec {
  const trimmed = issueId.trim();
  const key = trimmed ? sanitizeWorktreeKey(trimmed) : unscopedWorktreeKey(nowIso, pid);
  return {
    key,
    branch: `project-agent-${key}`
  };
}

export function ensureIssueWorktreeAndMaybeRelaunch(args: {
  cwd: string;
  issueId: string;
  nowIso?: string;
  pid?: number;
}): WorktreeBootstrapResult {
  if (process.env[DISABLE_WORKTREE_ENV] === "1") {
    return { action: "skipped", reason: `${DISABLE_WORKTREE_ENV}=1` };
  }
  if (process.env[BOOTSTRAP_GUARD_ENV] === "1") {
    return { action: "skipped", reason: `${BOOTSTRAP_GUARD_ENV}=1` };
  }

  const gitRoot = gitTopLevel(args.cwd);
  if (!gitRoot) {
    return { action: "skipped", reason: "not inside a git worktree" };
  }

  const spec = resolveWorktreeSpec(args.issueId, args.nowIso ?? new Date().toISOString(), args.pid ?? process.pid);
  const targetPath = join(gitRoot, WORKTREE_DIRNAME, spec.key);
  if (samePath(args.cwd, targetPath)) {
    return { action: "already-in-target", path: targetPath, branch: spec.branch };
  }

  const created = ensureWorktreeExists(gitRoot, targetPath, spec.branch);
  return { action: "relaunch", path: targetPath, branch: spec.branch, created };
}

export function worktreeBootstrapGuardEnv(): string {
  return BOOTSTRAP_GUARD_ENV;
}

function ensureWorktreeExists(gitRoot: string, targetPath: string, branch: string): boolean {
  if (existsSync(targetPath)) {
    return false;
  }

  mkdirSync(dirname(targetPath), { recursive: true });
  const hasBranch = gitSuccess(gitRoot, ["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
  const args = hasBranch
    ? ["worktree", "add", targetPath, branch]
    : ["worktree", "add", "-b", branch, targetPath, "HEAD"];

  const result = spawnSync("git", args, { cwd: gitRoot, encoding: "utf8" });
  if (result.status !== 0) {
    const stderr = (result.stderr || "").trim();
    const stdout = (result.stdout || "").trim();
    const details = stderr || stdout || "unknown error";
    throw new Error(`Failed to prepare git worktree at ${targetPath}: ${details}`);
  }
  return true;
}

function gitTopLevel(cwd: string): string | null {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    return null;
  }
  const root = result.stdout.trim();
  return root ? root : null;
}

function gitSuccess(cwd: string, args: string[]): boolean {
  const result = spawnSync("git", args, { cwd });
  return result.status === 0;
}

function samePath(a: string, b: string): boolean {
  const left = resolveMaybeRealPath(a);
  const right = resolveMaybeRealPath(b);
  return left === right;
}

function resolveMaybeRealPath(path: string): string {
  const resolved = resolve(path);
  if (!existsSync(resolved)) {
    return resolved;
  }
  try {
    return realpathSync(resolved);
  } catch {
    return resolved;
  }
}
