import assert from "node:assert/strict";
import { test } from "node:test";

import type { SerialPortIdentity } from "./ch340Port.ts";
import { isUsbSerialDevicePresent, startUsbStatusPolling } from "./usbStatus.ts";

// `isCh340Port`/`findCh340PortPath` themselves are tested in
// ch340Port.test.ts (see that file's header comment) — this file only
// exercises usbStatus.ts's own additions: the list-based presence check and
// the poll/push-on-change wrapper around it.
function fakePort(vendorId: string | undefined, productId: string | undefined): SerialPortIdentity {
  return { path: "COM3", vendorId, productId };
}

test("isUsbSerialDevicePresent returns true when the injected list includes a CH340 port", async () => {
  const listPorts = async (): Promise<SerialPortIdentity[]> => [
    fakePort("0403", "6001"),
    fakePort("1a86", "7523"),
  ];

  assert.equal(await isUsbSerialDevicePresent(listPorts), true);
});

test("isUsbSerialDevicePresent returns false when the injected list has no CH340 port", async () => {
  const listPorts = async (): Promise<SerialPortIdentity[]> => [fakePort("0403", "6001")];

  assert.equal(await isUsbSerialDevicePresent(listPorts), false);
});

test("isUsbSerialDevicePresent returns false when the injected list is empty", async () => {
  const listPorts = async (): Promise<SerialPortIdentity[]> => [];

  assert.equal(await isUsbSerialDevicePresent(listPorts), false);
});

test("isUsbSerialDevicePresent returns false rather than throwing when listPorts rejects", async () => {
  const listPorts = async (): Promise<SerialPortIdentity[]> => {
    throw new Error("native binding failure");
  };

  assert.equal(await isUsbSerialDevicePresent(listPorts), false);
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

test("startUsbStatusPolling supports an async checkDevicePresent, pushing once it resolves", async () => {
  const received: boolean[] = [];

  const stop = startUsbStatusPolling(
    () => Promise.resolve(true),
    (connected) => received.push(connected),
  );

  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(received, [true]);
  stop();
});
