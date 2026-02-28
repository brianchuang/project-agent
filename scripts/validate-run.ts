import { readFileSync } from "node:fs";
import { validateRunArtifact, type RunArtifact } from "../src/workflowArtifacts";

function usage(): never {
  console.error("Usage: npm run validate-run -- <path-to-run.json>");
  process.exit(1);
}

const artifactPath = (process.argv[2] || "").trim();
if (!artifactPath) {
  usage();
}

let parsed: unknown;
try {
  parsed = JSON.parse(readFileSync(artifactPath, "utf8"));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to read artifact JSON: ${message}`);
  process.exit(1);
}

const errors = validateRunArtifact(parsed as RunArtifact);
if (errors.length > 0) {
  console.error("Run artifact validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log("Run artifact validation passed.");
