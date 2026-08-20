import assert from "node:assert/strict";
import { test } from "node:test";

import { appendLogLines, clearLogLines, MAX_LOG_PANEL_LINES } from "./logPanel.ts";

test("appendLogLines appends new lines after existing ones, in order", () => {
  assert.deepEqual(appendLogLines(["a", "b"], ["c", "d"]), ["a", "b", "c", "d"]);
});

test("appendLogLines returns the existing lines unchanged when no new lines arrive", () => {
  assert.deepEqual(appendLogLines(["a", "b"], []), ["a", "b"]);
});

test("appendLogLines returns just the new lines when there are no existing ones", () => {
  assert.deepEqual(appendLogLines([], ["a", "b"]), ["a", "b"]);
});

test("appendLogLines does not mutate the existing lines array passed in", () => {
  const existing = ["a", "b"];

  appendLogLines(existing, ["c"]);

  assert.deepEqual(existing, ["a", "b"]);
});

test("appendLogLines drops the oldest lines once the combined total exceeds maxLines", () => {
  assert.deepEqual(appendLogLines(["a", "b", "c"], ["d"], 3), ["b", "c", "d"]);
});

test("appendLogLines keeps exactly maxLines when the combined total lands exactly on the cap", () => {
  assert.deepEqual(appendLogLines(["a", "b"], ["c"], 3), ["a", "b", "c"]);
});

test("appendLogLines drops multiple oldest lines when a large batch arrives at once", () => {
  assert.deepEqual(appendLogLines(["a", "b", "c"], ["d", "e", "f", "g"], 3), ["e", "f", "g"]);
});

test("appendLogLines defaults its cap to MAX_LOG_PANEL_LINES (500)", () => {
  const existing = Array.from({ length: 500 }, (_, i) => `line-${i}`);

  const result = appendLogLines(existing, ["new-line"]);

  assert.equal(result.length, 500);
  assert.equal(result[result.length - 1], "new-line");
  assert.equal(result[0], "line-1");
});

test("MAX_LOG_PANEL_LINES is 500 per spec.md's capped-buffer decision", () => {
  assert.equal(MAX_LOG_PANEL_LINES, 500);
});

test("clearLogLines returns an empty array", () => {
  assert.deepEqual(clearLogLines(), []);
});
