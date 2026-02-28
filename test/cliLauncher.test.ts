import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

const binPath = join(import.meta.dirname, "..", "bin", "project-agent");

describe("project-agent launcher", () => {
  test("imports tsx loader from CLI install path instead of current directory", () => {
    const launcher = readFileSync(binPath, "utf8");
    assert.match(launcher, /TSX_LOADER="\$SCRIPT_DIR\/\.\.\/node_modules\/tsx\/dist\/loader\.mjs"/);
    assert.doesNotMatch(launcher, /node --import tsx\b/);
  });
});
