import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildCommandFrame,
  CMD_RUN,
  DEVICE_LED,
  DEVICE_MOTOR,
  DEVICE_SERVO,
  DEVICE_SHOOT,
  MOVEMENT_VALUES,
  SHOOT_VALUE,
} from "./commandFrame.ts";

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

// Per ADR-001 (.gh-workflows/plans/20260815_065830-car-movement-light-controls/grill/ADR-001.md),
// every movement direction's exact wire value, reverse-engineered from the
// firmware's runModule().
const MOVEMENT_FRAME_CASES: Array<[direction: keyof typeof MOVEMENT_VALUES, value: number]> = [
  ["stop", 0x00],
  ["forward", 0x01],
  ["backward", 0x02],
  ["left", 0x03],
  ["right", 0x04],
  ["rotate-left", 0x09],
  ["rotate-right", 0x0a],
];

for (const [direction, value] of MOVEMENT_FRAME_CASES) {
  test(`buildCommandFrame produces the exact ADR-001 motor frame for "${direction}"`, () => {
    const frame = buildCommandFrame({
      action: CMD_RUN,
      device: DEVICE_MOTOR,
      value: MOVEMENT_VALUES[direction],
    });

    assert.deepEqual(
      [...frame],
      [0xff, 0x55, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x0c, 0x00, value],
    );
  });
}

// Per water-gun-control ADR-001
// (.gh-workflows/plans/20260815_083408-water-gun-control/grill/ADR-001.md),
// the shoot command's exact wire value.
test("buildCommandFrame produces the exact ADR-001 shoot frame", () => {
  const frame = buildCommandFrame({ action: CMD_RUN, device: DEVICE_SHOOT, value: SHOOT_VALUE });

  assert.deepEqual(
    [...frame],
    [0xff, 0x55, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x08, 0x00, 0x00],
  );
});

// Per water-gun-control ADR-001
// (.gh-workflows/plans/20260815_083408-water-gun-control/grill/ADR-001.md),
// the servo command's exact wire value for representative angles across the
// full 1-180 range, including both bounds.
const SERVO_FRAME_CASES: number[] = [1, 5, 45, 90, 135, 179, 180];

for (const angle of SERVO_FRAME_CASES) {
  test(`buildCommandFrame produces the exact ADR-001 servo frame for angle ${angle}`, () => {
    const frame = buildCommandFrame({ action: CMD_RUN, device: DEVICE_SERVO, value: angle });

    assert.deepEqual(
      [...frame],
      [0xff, 0x55, 0x0a, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x00, angle],
    );
  });
}
