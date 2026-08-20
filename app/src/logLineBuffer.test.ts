import assert from "node:assert/strict";
import { test } from "node:test";

import { formatLogTimestamp, LogLineBuffer, MAX_PENDING_LENGTH } from "./logLineBuffer.ts";

test("formatLogTimestamp renders zero-padded HH:MM:SS.mmm wrapped in brackets", () => {
  const date = new Date(2026, 0, 1, 9, 5, 3, 7);

  assert.equal(formatLogTimestamp(date), "[09:05:03.007]");
});

test("formatLogTimestamp pads double-digit and triple-digit components correctly", () => {
  const date = new Date(2026, 0, 1, 14, 32, 5, 123);

  assert.equal(formatLogTimestamp(date), "[14:32:05.123]");
});

test("push buffers a chunk with no newline and emits no lines yet", () => {
  const buffer = new LogLineBuffer(() => new Date(2026, 0, 1, 0, 0, 0, 0));

  assert.deepEqual(buffer.push("partial data"), []);
});

test("push emits a single completed line prefixed with the receipt timestamp", () => {
  const buffer = new LogLineBuffer(() => new Date(2026, 0, 1, 14, 32, 5, 123));

  assert.deepEqual(buffer.push("hello\n"), ["[14:32:05.123] hello"]);
});

test("push emits every completed line from a chunk containing multiple newlines, in order", () => {
  const buffer = new LogLineBuffer(() => new Date(2026, 0, 1, 0, 0, 0, 0));

  assert.deepEqual(buffer.push("first\nsecond\nthird\n"), [
    "[00:00:00.000] first",
    "[00:00:00.000] second",
    "[00:00:00.000] third",
  ]);
});

test("push discards the trailing carriage return from Serial.println()-style CRLF output", () => {
  const buffer = new LogLineBuffer(() => new Date(2026, 0, 1, 0, 0, 0, 0));

  assert.deepEqual(buffer.push("hello\r\n"), ["[00:00:00.000] hello"]);
});

test("a partial line spanning two pushes is only emitted once the newline arrives", () => {
  const buffer = new LogLineBuffer(() => new Date(2026, 0, 1, 0, 0, 0, 0));

  assert.deepEqual(buffer.push("hel"), []);
  assert.deepEqual(buffer.push("lo\n"), ["[00:00:00.000] hello"]);
});

test("a trailing partial line after a completed line stays buffered until its own newline arrives", () => {
  const buffer = new LogLineBuffer(() => new Date(2026, 0, 1, 0, 0, 0, 0));

  assert.deepEqual(buffer.push("first\nsecond-partial"), ["[00:00:00.000] first"]);
  assert.deepEqual(buffer.push("-rest\n"), ["[00:00:00.000] second-partial-rest"]);
});

test("push accepts a Buffer chunk, not just a string", () => {
  const buffer = new LogLineBuffer(() => new Date(2026, 0, 1, 0, 0, 0, 0));

  assert.deepEqual(buffer.push(Buffer.from("from a buffer\n", "utf8")), [
    "[00:00:00.000] from a buffer",
  ]);
});

test("push on an empty chunk emits no lines and does not throw", () => {
  const buffer = new LogLineBuffer(() => new Date(2026, 0, 1, 0, 0, 0, 0));

  assert.deepEqual(buffer.push(""), []);
});

test("an empty line between two newlines is emitted as an empty (timestamp-only) line", () => {
  const buffer = new LogLineBuffer(() => new Date(2026, 0, 1, 0, 0, 0, 0));

  assert.deepEqual(buffer.push("first\n\nthird\n"), [
    "[00:00:00.000] first",
    "[00:00:00.000] ",
    "[00:00:00.000] third",
  ]);
});

test("a chunk exceeding the maximum pending size with no newline is discarded rather than retained indefinitely", () => {
  const buffer = new LogLineBuffer(() => new Date(2026, 0, 1, 0, 0, 0, 0));
  const oversizedChunkWithNoNewline = "x".repeat(MAX_PENDING_LENGTH + 1);

  assert.deepEqual(buffer.push(oversizedChunkWithNoNewline), []);
  assert.deepEqual(buffer.push("tail\n"), ["[00:00:00.000] tail"]);
});

test("repeated newline-free chunks that cumulatively exceed the cap do not grow pending forever", () => {
  const buffer = new LogLineBuffer(() => new Date(2026, 0, 1, 0, 0, 0, 0));
  const chunkWithNoNewline = "x".repeat(1024);
  const chunkCount = 20;

  for (let i = 0; i < chunkCount; i += 1) {
    assert.deepEqual(buffer.push(chunkWithNoNewline), []);
  }
  const [flushedLine] = buffer.push("\n");

  // If pending grew unbounded, the flushed line would carry all
  // chunkCount * chunkWithNoNewline.length characters ever pushed; proving
  // it stayed well under that (bounded instead by the cap) shows discards
  // happened along the way rather than one endless concatenation.
  assert.ok(flushedLine.length < chunkCount * chunkWithNoNewline.length);
});

test("LogLineBuffer defaults to the real system clock when no now() is injected", () => {
  const buffer = new LogLineBuffer();

  const [line] = buffer.push("hello\n");

  assert.match(line, /^\[\d{2}:\d{2}:\d{2}\.\d{3}\] hello$/);
});
