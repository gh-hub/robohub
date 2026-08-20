import assert from "node:assert/strict";
import { test } from "node:test";

import { findCh340PortPath, isCh340Port, type SerialPortIdentity } from "./ch340Port.ts";

function fakePort(
  path: string,
  vendorId: string | undefined,
  productId: string | undefined,
): SerialPortIdentity {
  return { path, vendorId, productId };
}

test("isCh340Port matches the documented CH340 VID/PID in lowercase hex with no 0x prefix", () => {
  assert.equal(isCh340Port(fakePort("COM3", "1a86", "7523")), true);
});

test("isCh340Port matches when the library reports VID/PID with a 0x prefix", () => {
  assert.equal(isCh340Port(fakePort("COM3", "0x1a86", "0x7523")), true);
});

test("isCh340Port matches regardless of hex case", () => {
  assert.equal(isCh340Port(fakePort("COM3", "1A86", "7523")), true);
});

test("isCh340Port returns false for a non-matching vendor/product ID pair", () => {
  assert.equal(isCh340Port(fakePort("COM3", "0403", "6001")), false);
});

test("isCh340Port returns false when vendorId or productId is missing", () => {
  assert.equal(isCh340Port(fakePort("COM3", undefined, "7523")), false);
  assert.equal(isCh340Port(fakePort("COM3", "1a86", undefined)), false);
});

test("findCh340PortPath returns the matching port's path when the injected list includes a CH340 port", async () => {
  const listPorts = async (): Promise<SerialPortIdentity[]> => [
    fakePort("COM4", "0403", "6001"),
    fakePort("COM7", "1a86", "7523"),
  ];

  assert.equal(await findCh340PortPath(listPorts), "COM7");
});

test("findCh340PortPath returns null when the injected list has no CH340 port", async () => {
  const listPorts = async (): Promise<SerialPortIdentity[]> => [fakePort("COM4", "0403", "6001")];

  assert.equal(await findCh340PortPath(listPorts), null);
});

test("findCh340PortPath returns null when the injected list is empty", async () => {
  const listPorts = async (): Promise<SerialPortIdentity[]> => [];

  assert.equal(await findCh340PortPath(listPorts), null);
});

test("findCh340PortPath returns the first match when multiple CH340 ports are listed", async () => {
  const listPorts = async (): Promise<SerialPortIdentity[]> => [
    fakePort("COM7", "1a86", "7523"),
    fakePort("COM9", "1a86", "7523"),
  ];

  assert.equal(await findCh340PortPath(listPorts), "COM7");
});
