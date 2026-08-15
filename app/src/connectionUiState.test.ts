import assert from "node:assert/strict";
import { test } from "node:test";

import type { ConnectionState } from "./carConnection.ts";
import {
  mapAimControlUiState,
  mapConnectionStatusToUiState,
  mapLightControlUiState,
  mapMovementControlUiState,
  mapShootControlUiState,
} from "./connectionUiState.ts";

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

const DISCONNECTED: ConnectionState = { status: "disconnected", protocol: null, message: null };
const CONNECTING: ConnectionState = { status: "connecting", protocol: null, message: null };
const CONNECTED_TCP100: ConnectionState = { status: "connected", protocol: "tcp100", message: null };
const CONNECTED_HTTP80: ConnectionState = { status: "connected", protocol: "http80", message: null };
const ERROR: ConnectionState = { status: "error", protocol: null, message: null };

for (const [name, state] of [
  ["disconnected", DISCONNECTED],
  ["connecting", CONNECTING],
  ["connected over http80", CONNECTED_HTTP80],
  ["error", ERROR],
] as const) {
  test(`light buttons are disabled when connection is ${name}, regardless of lights-on state`, () => {
    assert.equal(mapLightControlUiState(state, false).disabled, true);
    assert.equal(mapLightControlUiState(state, true).disabled, true);
  });
}

test("light buttons are enabled when connected over tcp100", () => {
  assert.equal(mapLightControlUiState(CONNECTED_TCP100, false).disabled, false);
  assert.equal(mapLightControlUiState(CONNECTED_TCP100, true).disabled, false);
});

test("light buttons' state label mirrors the lights-on boolean when off", () => {
  assert.equal(mapLightControlUiState(CONNECTED_TCP100, false).stateLabel, "Off");
});

test("light buttons' state label mirrors the lights-on boolean when on", () => {
  assert.equal(mapLightControlUiState(CONNECTED_TCP100, true).stateLabel, "On");
});

test("light buttons' state label reflects lights-on even while disabled (e.g. disconnected)", () => {
  assert.equal(mapLightControlUiState(DISCONNECTED, true).stateLabel, "On");
  assert.equal(mapLightControlUiState(DISCONNECTED, false).stateLabel, "Off");
});

for (const [name, state] of [
  ["disconnected", DISCONNECTED],
  ["connecting", CONNECTING],
  ["connected over http80", CONNECTED_HTTP80],
  ["error", ERROR],
] as const) {
  test(`movement buttons are disabled when connection is ${name}`, () => {
    assert.equal(mapMovementControlUiState(state).disabled, true);
  });
}

test("movement buttons are enabled when connected over tcp100", () => {
  assert.equal(mapMovementControlUiState(CONNECTED_TCP100).disabled, false);
});

for (const [name, state] of [
  ["disconnected", DISCONNECTED],
  ["connecting", CONNECTING],
  ["connected over http80", CONNECTED_HTTP80],
  ["error", ERROR],
] as const) {
  test(`shoot button is disabled when connection is ${name}`, () => {
    assert.equal(mapShootControlUiState(state).disabled, true);
  });
}

test("shoot button is enabled when connected over tcp100", () => {
  assert.equal(mapShootControlUiState(CONNECTED_TCP100).disabled, false);
});

for (const [name, state] of [
  ["disconnected", DISCONNECTED],
  ["connecting", CONNECTING],
  ["connected over http80", CONNECTED_HTTP80],
  ["error", ERROR],
] as const) {
  test(`aim Up/Down buttons are both disabled when connection is ${name}, regardless of angle`, () => {
    assert.equal(mapAimControlUiState(state, 90).upDisabled, true);
    assert.equal(mapAimControlUiState(state, 90).downDisabled, true);
  });
}

test("aim Up/Down buttons are both enabled when connected over tcp100 at a mid-range angle", () => {
  const uiState = mapAimControlUiState(CONNECTED_TCP100, 90);

  assert.equal(uiState.upDisabled, false);
  assert.equal(uiState.downDisabled, false);
});

test("aim Up button is disabled at the 180 upper bound", () => {
  assert.equal(mapAimControlUiState(CONNECTED_TCP100, 180).upDisabled, true);
});

test("aim Down button stays enabled at the 180 upper bound", () => {
  assert.equal(mapAimControlUiState(CONNECTED_TCP100, 180).downDisabled, false);
});

test("aim Down button is disabled at the 1 lower bound", () => {
  assert.equal(mapAimControlUiState(CONNECTED_TCP100, 1).downDisabled, true);
});

test("aim Up button stays enabled at the 1 lower bound", () => {
  assert.equal(mapAimControlUiState(CONNECTED_TCP100, 1).upDisabled, false);
});

test("aim Up/Down buttons are both disabled at the bounds when also disconnected", () => {
  assert.equal(mapAimControlUiState(DISCONNECTED, 180).upDisabled, true);
  assert.equal(mapAimControlUiState(DISCONNECTED, 1).downDisabled, true);
});
