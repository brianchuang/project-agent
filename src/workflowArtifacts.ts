import { z } from "zod";

export type TestResult = {
  command: string;
  exitCode: number;
  output?: string;
};

export const RUN_ARTIFACT_VERSION = 1;

const runArtifactVersionSchema = z.number().int().superRefine((value, ctx) => {
  if (value !== RUN_ARTIFACT_VERSION) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `unsupported run artifact version: ${value} (expected ${RUN_ARTIFACT_VERSION})`
    });
  }
});

const testResultSchema = z.object({
  command: z.string(),
  exitCode: z.number().int(),
  output: z.string().optional()
});

export const runArtifactSchema = z.object({
  version: runArtifactVersionSchema,
  issueId: z.string(),
  startedAt: z.string(),
  endedAt: z.string().optional(),
  status: z.enum(["in_progress", "done", "blocked"]),
  linear: z.object({
    planCommentPosted: z.boolean(),
    progressCommentPosted: z.boolean(),
    doneCommentPosted: z.boolean(),
    stateTransitionedTo: z.string().optional()
  }),
  changes: z.object({
    filesTouched: z.array(z.string()),
    commitShas: z.array(z.string()),
    pullRequestUrl: z.string()
  }),
  tests: z.object({
    commands: z.array(z.string()),
    results: z.array(testResultSchema)
  }),
  verification: z.array(z.string()),
  summary: z.string(),
  blockers: z.array(z.string())
});

export type RunArtifact = z.infer<typeof runArtifactSchema>;
export type RunArtifactParseResult =
  | { artifact: RunArtifact; errors: [] }
  | { artifact: null; errors: string[] };

export function createInitialRunArtifact(issueId: string, nowIso = new Date().toISOString()): RunArtifact {
  return {
    version: RUN_ARTIFACT_VERSION,
    issueId,
    startedAt: nowIso,
    status: "in_progress",
    linear: {
      planCommentPosted: false,
      progressCommentPosted: false,
      doneCommentPosted: false
    },
    changes: {
      filesTouched: [],
      commitShas: [],
      pullRequestUrl: ""
    },
    tests: {
      commands: [],
      results: []
    },
    verification: [],
    summary: "",
    blockers: []
  };
}

export function parseRunArtifact(input: unknown): RunArtifactParseResult {
  const result = runArtifactSchema.safeParse(input);
  if (result.success) {
    return { artifact: result.data, errors: [] };
  }

  const errors = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    return `${path}${issue.message}`;
  });
  return { artifact: null, errors };
}

export function validateRunArtifact(artifact: RunArtifact): string[] {
  const errors: string[] = [];

  if (artifact.version !== RUN_ARTIFACT_VERSION) {
    errors.push(`version must equal ${RUN_ARTIFACT_VERSION}`);
  }
  if (!artifact.startedAt.trim()) {
    errors.push("startedAt is required");
  }

  if (artifact.status === "done") {
    if (!artifact.issueId.trim()) {
      errors.push("status=done requires issueId");
    }
    if (!artifact.linear.planCommentPosted) {
      errors.push("status=done requires linear.planCommentPosted=true");
    }
    if (!artifact.linear.progressCommentPosted) {
      errors.push("status=done requires linear.progressCommentPosted=true");
    }
    if (!artifact.linear.doneCommentPosted) {
      errors.push("status=done requires linear.doneCommentPosted=true");
    }
    if (!artifact.summary.trim()) {
      errors.push("status=done requires summary");
    }
    if (artifact.tests.results.length === 0) {
      errors.push("status=done requires at least one tests.results entry");
    }
    if (artifact.tests.results.some((r) => r.exitCode !== 0)) {
      errors.push("status=done requires all tests.results exitCode values to be 0");
    }
    if (artifact.verification.length === 0) {
      errors.push("status=done requires at least one manual verification step");
    }
    if (!artifact.changes.pullRequestUrl.trim()) {
      errors.push("status=done requires changes.pullRequestUrl");
    }
    if (!artifact.endedAt?.trim()) {
      errors.push("status=done requires endedAt");
    }
  }

  if (artifact.status === "blocked") {
    if (artifact.blockers.length === 0) {
      errors.push("status=blocked requires at least one blocker");
    }
    if (!artifact.endedAt?.trim()) {
      errors.push("status=blocked requires endedAt");
    }
  }

  return errors;
}
