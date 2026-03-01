# High-Level Design (MVP)

This project is a thin wrapper around Codex.
Linear is handled through Codex MCP tools, and `run.json` is the deterministic local audit artifact.

## Scope

- No background scheduler
- No queue worker
- No direct Linear API runtime in wrapper path
- One run at a time; it may start unscoped and then bind to an issue during triage

## Run Loop

1. Prepare run context
- `project-agent [ISSUE_ID]` creates:
  - `<cwd>/.project-agent-artifacts/<repo>-<hash>/<RUN_KEY>/run.json`
  - `<cwd>/.project-agent-artifacts/<repo>-<hash>/<RUN_KEY>/codex-instructions.md`
  - `<cwd>/.project-agent-artifacts/<repo>-<hash>/<RUN_KEY>/skills/linear.md`
  - `<cwd>/.project-agent-artifacts/<repo>-<hash>/<RUN_KEY>/skills/github.md`
  - `<cwd>/.project-agent-artifacts/<repo>-<hash>/<RUN_KEY>/skills/skills.json`
- If no issue ID is provided, the run starts as intake and Codex triages to reuse/create an issue, then updates `run.json.issueId` before implementation.
- `start-run` and `issue-run` remain as backward-compatible aliases.

2. Execute with Codex
- Codex uses Linear MCP to:
  - triage/clarify acceptance criteria
  - post plan before code
  - post progress updates
  - open/update PR and capture PR URL in `run.json`
  - post done evidence with PR details
  - transition issue state

3. Closeout validation
- `npm run validate-run -- <path-to-run.json>`
- Completion is valid only when validator passes.

## Deterministic Gate

`status=done` requires:
- issueId resolved in `run.json`
- linear plan/progress/done comments marked true in artifact
- at least one passing test result
- non-empty verification steps
- non-empty `changes.pullRequestUrl`
- summary and `endedAt`

`status=blocked` requires:
- at least one blocker
- `endedAt`

## Why this shape

- Keeps orchestration simple and explicit
- Pushes execution responsibility to Codex (agentic workflow)
- Preserves reproducibility via strict artifact validation
