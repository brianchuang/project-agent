import { readFileSync } from "node:fs";
import { basename } from "node:path";
import { createHash } from "node:crypto";

export const PROJECT_CONFIG_FILENAMES = ["project-agent.json", ".project-agent.json"] as const;

export type ProjectConfig = {
  project: string;
};

export type LoadedProjectConfig = {
  path: string;
  config: ProjectConfig;
};

export function loadProjectConfig(cwd: string): LoadedProjectConfig | null {
  for (const filename of PROJECT_CONFIG_FILENAMES) {
    const path = `${cwd}/${filename}`;
    try {
      const raw = readFileSync(path, "utf8");
      return {
        path,
        config: parseProjectConfig(raw, path)
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        continue;
      }
      throw error;
    }
  }
  return null;
}

export function parseProjectConfig(raw: string, pathForError: string): ProjectConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid project config at ${pathForError}: JSON parse failed: ${message}`);
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`Invalid project config at ${pathForError}: expected a JSON object`);
  }

  const config = parsed as Record<string, unknown>;
  if (typeof config.project !== "string" || !config.project.trim()) {
    throw new Error(`Invalid project config at ${pathForError}: "project" must be a non-empty string`);
  }
  return {
    project: config.project.trim()
  };
}

export function resolveProjectNamespace(repoRoot: string, config: ProjectConfig | null): string {
  if (config?.project) {
    return sanitizeProjectName(config.project);
  }
  const repoName = basename(repoRoot) || "repo";
  const hash = createHash("sha1").update(repoRoot).digest("hex").slice(0, 10);
  return `${repoName}-${hash}`;
}

export function sanitizeProjectName(project: string): string {
  const cleaned = project
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "project";
}
