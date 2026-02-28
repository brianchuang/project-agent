# Project Agent MVP (MCP-first)

Thin wrapper around Codex for deterministic software workflow with Linear as source of truth.

This MVP does not schedule work and does not require a direct Linear API runtime for the wrapper path.
Codex is expected to use Linear via MCP tools during the run.

## Requirements

- Node.js `>=22`
- Codex environment with Linear MCP access

## Core Idea

For each issue run, enforce a reproducible loop:

1. Triage/clarify acceptance criteria in Linear
2. Post plan comment before coding
3. Implement changes
4. Run tests and collect evidence
5. Post progress + done comments in Linear
6. Mark done only after evidence exists

Run-level evidence is stored in a global artifacts directory and validated locally.

## Usage

Run from this repository root with:

```bash
bin/project-agent
```

Or install/link this package to use `project-agent` on your PATH.

Prepare a run context with a known Linear issue:

```bash
project-agent AG-123
```

Backward-compatible aliases still work:

```bash
npm run start-run -- AG-123
npm run issue-run -- AG-123
bin/start-run AG-123
bin/issue-run AG-123
```

Or start from free-form intake (no issue provided yet):

```bash
project-agent
```

In free-form mode, Codex must triage first, then bind the run to an existing or newly-created Linear issue by setting `run.json.issueId` before coding.

`run.json` is versioned (`version` field) and `validate-run` enforces supported schema versions.

By default this creates files under:

- `<cwd>/.project-agent-artifacts/<repo>-<hash>/<RUN_KEY>/run.json`
- `<cwd>/.project-agent-artifacts/<repo>-<hash>/<RUN_KEY>/codex-instructions.md`

Where `<RUN_KEY>` is the issue ID when provided, or an `UNSCOPED-<timestamp>` key for free-form intake.

Optional override:

```bash
project-agent AG-123 --artifacts-dir /tmp/project-agent-artifacts
project-agent --artifacts-dir /tmp/project-agent-artifacts
npm run start-run -- AG-123 --artifacts-dir /tmp/project-agent-artifacts
npm run start-run -- --artifacts-dir /tmp/project-agent-artifacts
```

Or set:

```bash
export PROJECT_AGENT_ARTIFACTS_DIR=/tmp/project-agent-artifacts
```

Optional project config in the current directory:

The CLI checks for `project-agent.json` first, then `.project-agent.json`.
If found, it uses the config to define project identity:

```json
{
  "project": "project-agent"
}
```

- `project` (required): project namespace used in artifact paths and default Linear project scope in generated Codex instructions.
- Artifact root location remains controlled by CLI flags/env/defaults.
- If config is missing, default behavior is unchanged.
- If config is invalid, the CLI exits with a clear file-path-specific validation error.

Then run Codex in this repository and follow `codex-instructions.md`.

By default, `project-agent` now launches `codex` automatically after preparing artifacts, with an initial prompt that points Codex at the generated `codex-instructions.md` and default Linear project scope from config.
Use `--no-codex` (or `PROJECT_AGENT_NO_CODEX=1`) when you only want artifact preparation:

```bash
project-agent AG-123 --no-codex
PROJECT_AGENT_NO_CODEX=1 project-agent
```

Validate completion gate:

```bash
npm run validate-run -- <cwd>/.project-agent-artifacts/<repo>-<hash>/AG-123/run.json
```

A run is complete only when validation passes.

## Workflow Contract

See [AGENTS.md](/Users/brianchuang/project-agent/AGENTS.md) for the required behavior Codex must follow when operating against Linear.

## Tests

```bash
npm test
```
