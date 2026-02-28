# Project Agent Workflow Contract

This repository uses Codex with Linear MCP as the operational source of truth.
Do not treat local files or terminal output as completion authority; Linear state and comments are authoritative.

## Required Execution Loop

For every implementation run tied to a Linear issue:

1. Confirm issue and acceptance criteria
- Use Linear MCP to load the issue and comments.
- If acceptance criteria are missing or ambiguous, post clarification questions in Linear and stop.

2. Align branch with Linear
- Read the issue `gitBranchName` from Linear and switch/create that branch before editing files.
- Do not implement from unscoped branches once an issue is bound.

3. Plan before code
- Post a concrete implementation plan comment to the issue before editing files.
- Set `run.json` field `linear.planCommentPosted=true`.

4. Implement against plan
- Make minimal, scoped changes that satisfy acceptance criteria.
- Keep progress visible: post at least one progress update in Linear.
- Set `linear.progressCommentPosted=true`.

5. Verify with evidence
- Run relevant tests.
- Record each test command and exit code in `run.json` under `tests`.

6. Document and transition
- Post done comment in Linear with:
  - summary of what changed
  - tests executed and results
  - manual verification steps
- Only then transition issue state to done/review.
- Set `linear.doneCommentPosted=true`.

## Deterministic Artifact Gate

Each issue run must maintain:
- `~/.project-agent-artifacts/<repo>-<hash>/<ISSUE_ID>/run.json` (default path)
- `~/.project-agent-artifacts/<repo>-<hash>/<ISSUE_ID>/codex-instructions.md`

A run may be considered complete only when:
- `run.json` has `status="done"`
- `npm run validate-run -- <path-to-run.json>` passes

If blocked:
- set `status="blocked"`
- include concrete blockers in `blockers`
- include `endedAt`

## Version Control Boundaries

- Do not rewrite or discard unrelated local changes.
- Keep changes scoped to the issue.
- Summarize changed files in `run.json` (`changes.filesTouched`).

## Non-goals

- No background schedulers or unattended queue processing in MVP.
- No direct Linear API runtime required for this wrapper flow; use MCP in Codex.
