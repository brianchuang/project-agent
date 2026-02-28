export type TestResult = {
  command: string;
  exitCode: number;
  output?: string;
};

export type RunArtifact = {
  version: 1;
  issueId: string;
  startedAt: string;
  endedAt?: string;
  status: "in_progress" | "done" | "blocked";
  linear: {
    planCommentPosted: boolean;
    progressCommentPosted: boolean;
    doneCommentPosted: boolean;
    stateTransitionedTo?: string;
  };
  changes: {
    filesTouched: string[];
    commitShas: string[];
    pullRequestUrl: string;
  };
  tests: {
    commands: string[];
    results: TestResult[];
  };
  verification: string[];
  summary: string;
  blockers: string[];
};

export function createInitialRunArtifact(issueId: string, nowIso = new Date().toISOString()): RunArtifact {
  return {
    version: 1,
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

export function validateRunArtifact(artifact: RunArtifact): string[] {
  const errors: string[] = [];

  if (artifact.version !== 1) {
    errors.push("version must equal 1");
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
