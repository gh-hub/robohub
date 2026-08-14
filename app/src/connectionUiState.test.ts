import assert from "node:assert/strict";
import { test } from "node:test";

import type { ConnectionState } from "./carConnection.ts";
import { mapConnectionStatusToUiState } from "./connectionUiState.ts";

test("disconnected state maps to an enabled Connect button and disconnected status text", () => {
  const state: ConnectionState = { status: "disconnected", protocol: null, message: null };

  assert.deepEqual(mapConnectionStatusToUiState(state), {
    buttonLabel: "Connect",
    buttonDisabled: false,
    statusText: "Disconnected",
    statusClass: "status-disconnected",
  });
});

test("connecting state maps to a disabled Connecting button", () => {
  const state: ConnectionState = { status: "connecting", protocol: null, message: null };

  assert.deepEqual(mapConnectionStatusToUiState(state), {
    buttonLabel: "Connecting…",
    buttonDisabled: true,
    statusText: "Connecting…",
    statusClass: "status-connecting",
  });
});

test("connected state maps to an enabled Disconnect button and shows the connection message", () => {
  const state: ConnectionState = {
    status: "connected",
    protocol: "tcp100",
    message: "Connected to 192.168.4.1:100 (TCP)",
  };

  assert.deepEqual(mapConnectionStatusToUiState(state), {
    buttonLabel: "Disconnect",
    buttonDisabled: false,
    statusText: "Connected to 192.168.4.1:100 (TCP)",
    statusClass: "status-connected",
  });
});

test("connected state with no message falls back to a generic Connected status text", () => {
  const state: ConnectionState = { status: "connected", protocol: "http80", message: null };

  assert.equal(mapConnectionStatusToUiState(state).statusText, "Connected");
});

test("error state maps to a re-enabled Connect button and shows the error message", () => {
  const state: ConnectionState = {
    status: "error",
    protocol: null,
    message: 'Car unreachable at 192.168.4.1 on TCP:100 or HTTP:80. Check that you\'ve joined the "ESP32-Car" Wi-Fi network.',
  };

  assert.deepEqual(mapConnectionStatusToUiState(state), {
    buttonLabel: "Connect",
    buttonDisabled: false,
    statusText: 'Car unreachable at 192.168.4.1 on TCP:100 or HTTP:80. Check that you\'ve joined the "ESP32-Car" Wi-Fi network.',
    statusClass: "status-error",
  });
});

test("error state with no message falls back to a generic error status text", () => {
  const state: ConnectionState = { status: "error", protocol: null, message: null };

  assert.equal(mapConnectionStatusToUiState(state).statusText, "Connection error");
});

test("error state's button is enabled, not stuck disabled", () => {
  const state: ConnectionState = { status: "error", protocol: null, message: null };

  assert.equal(mapConnectionStatusToUiState(state).buttonDisabled, false);
});
