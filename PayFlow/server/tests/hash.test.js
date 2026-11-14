import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

test("SHA-256 produces a stable 64-character digest", () => {
  const digest = createHash("sha256").update("payflow").digest("hex");
  assert.equal(digest.length, 64);
  assert.equal(digest, createHash("sha256").update("payflow").digest("hex"));
});
