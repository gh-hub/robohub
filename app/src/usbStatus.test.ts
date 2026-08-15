import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import * as path from "node:path";
import { test } from "node:test";

import { isUsbSerialDevicePresent, startUsbStatusPolling } from "./usbStatus.ts";

function makeTempDeviceDir(): string {
  return mkdtempSync(path.join(tmpdir(), "usb-status-test-"));
}

test("isUsbSerialDevicePresent returns true when a cu.usbserial-* entry exists in the directory", () => {
  const dir = makeTempDeviceDir();
  writeFileSync(path.join(dir, "cu.usbserial-1420"), "");

  const originalPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "darwin" });
  try {
    assert.equal(isUsbSerialDevicePresent(dir), true);
  } finally {
    Object.defineProperty(process, "platform", { value: originalPlatform });
  }
});

test("isUsbSerialDevicePresent returns false when no cu.usbserial-* entry exists", () => {
  const dir = makeTempDeviceDir();
  writeFileSync(path.join(dir, "cu.Bluetooth-Incoming-Port"), "");

  assert.equal(isUsbSerialDevicePresent(dir), false);
});

test("isUsbSerialDevicePresent returns false for a directory that doesn't exist", () => {
  assert.equal(isUsbSerialDevicePresent("/nonexistent-usb-status-test-dir"), false);
});

test("isUsbSerialDevicePresent returns false on non-macOS platforms even if a matching entry exists", () => {
  const dir = makeTempDeviceDir();
  writeFileSync(path.join(dir, "cu.usbserial-1420"), "");

  const originalPlatform = process.platform;
  Object.defineProperty(process, "platform", { value: "win32" });
  try {
    assert.equal(isUsbSerialDevicePresent(dir), false);
  } finally {
    Object.defineProperty(process, "platform", { value: originalPlatform });
  }
});

test("startUsbStatusPolling pushes the initial detected state immediately when a device is present", () => {
  const received: boolean[] = [];

  const stop = startUsbStatusPolling(
    () => true,
    (connected) => received.push(connected),
  );

  assert.deepEqual(received, [true]);
  stop();
});

test("startUsbStatusPolling does not push on the initial check when no device is present", () => {
  const received: boolean[] = [];

  const stop = startUsbStatusPolling(
    () => false,
    (connected) => received.push(connected),
  );

  assert.deepEqual(received, []);
  stop();
});

test("startUsbStatusPolling does not push again while status stays unchanged across polls", (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  const received: boolean[] = [];

  const stop = startUsbStatusPolling(
    () => true,
    (connected) => received.push(connected),
    2000,
  );
  t.mock.timers.tick(2000);
  t.mock.timers.tick(2000);

  assert.deepEqual(received, [true]);
  stop();
});

test("startUsbStatusPolling pushes again only when detected status changes", (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let connected = false;
  const received: boolean[] = [];

  const stop = startUsbStatusPolling(
    () => connected,
    (state) => received.push(state),
    2000,
  );
  assert.deepEqual(received, []);

  connected = true;
  t.mock.timers.tick(2000);
  assert.deepEqual(received, [true]);

  t.mock.timers.tick(2000);
  assert.deepEqual(received, [true]);

  connected = false;
  t.mock.timers.tick(2000);
  assert.deepEqual(received, [true, false]);

  stop();
});

test("startUsbStatusPolling's stop function halts further polling", (t) => {
  t.mock.timers.enable({ apis: ["setInterval"] });
  let connected = false;
  const received: boolean[] = [];

  const stop = startUsbStatusPolling(
    () => connected,
    (state) => received.push(state),
    2000,
  );
  stop();

  connected = true;
  t.mock.timers.tick(2000);

  assert.deepEqual(received, []);
});
