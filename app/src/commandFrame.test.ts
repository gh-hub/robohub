import assert from "node:assert/strict";
import { test } from "node:test";

import { buildCommandFrame, CMD_RUN, DEVICE_LED } from "./commandFrame.ts";

test("buildCommandFrame produces the exact ADR-001 LED-on frame", () => {
  const frame = buildCommandFrame({ action: CMD_RUN, device: DEVICE_LED, value: 1 });

  assert.deepEqual(
    [...frame],
    [0xff, 0x55, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x05, 0x00, 0x01],
  );
});

test("buildCommandFrame produces the exact ADR-001 LED-off frame", () => {
  const frame = buildCommandFrame({ action: CMD_RUN, device: DEVICE_LED, value: 0 });

  assert.deepEqual(
    [...frame],
    [0xff, 0x55, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x05, 0x00, 0x00],
  );
});

test("buildCommandFrame zero-fills every reserved payload byte for a non-LED device/action/value combination", () => {
  const frame = buildCommandFrame({ action: 0x02, device: 0x01, value: 0x64 });

  assert.deepEqual(
    [...frame],
    [0xff, 0x55, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x02, 0x01, 0x00, 0x64],
  );
});

test("buildCommandFrame always emits a 13-byte frame (2-byte header + length byte + 10-byte payload)", () => {
  const frame = buildCommandFrame({ action: CMD_RUN, device: DEVICE_LED, value: 1 });

  assert.equal(frame.length, 13);
});
