# 02 — Car connection module with protocol probing

**What to build:** A TCP connection module wrapping `net.Socket` with 4-state machine transitions (disconnected/connecting/connected/error), event-based close/error listening, and sequential port-100 → port-80 protocol probing, fully tested against local mock servers and verified against real QD001 hardware.

**Blocked by:** 01 — Scaffold the Electron + TypeScript app skeleton

**Status:** ready

- [x] `carConfig` constants module defines IP (192.168.4.1), SSID (ESP32-Car), and candidate ports
- [x] Connection module implements the 4-state machine and transitions correctly on connect/disconnect/error
- [x] Module listens for socket `close`/`error` events for connection-drop detection (event-based, not polled)
- [x] Sequential protocol probe tries TCP:100 first, then HTTP:80, with no movement side effects
- [x] Automated tests pass against local mock TCP/HTTP servers
- [ ] Real QD001 hardware protocol confirmed manually and documented
      Deferred — requires a human to physically join the `ESP32-Car` Wi-Fi network and cannot be done by an agent. See the "Manual verification" section below for a copy-pasteable script, and [PROGRESS/notes/implement-02-car-connection-module.md](../PROGRESS/notes/implement-02-car-connection-module.md) for the full explanation.

## Manual verification

Once you've joined the car's `ESP32-Car` Wi-Fi network (macOS Wi-Fi menu, password `12345678` per the firmware source in `docs/`), run this from a terminal to see which protocol the physical car actually speaks. It performs the exact same two-step probe the app's `CarConnection` module does — a bare TCP connect to port 100 with no bytes written, then, only if that fails, an HTTP `GET /` to port 80 — so neither step can make the car move.

```bash
node -e '
const net = require("node:net");
const http = require("node:http");
const HOST = "192.168.4.1";

function probeTcp() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(3000);
    socket.once("connect", () => { socket.destroy(); resolve(true); });
    socket.once("timeout", () => { socket.destroy(); resolve(false); });
    socket.once("error", () => resolve(false));
    socket.connect(100, HOST);
  });
}

function probeHttp() {
  return new Promise((resolve) => {
    const req = http.get({ host: HOST, port: 80, path: "/", timeout: 3000 }, (res) => {
      res.resume();
      res.once("end", () => resolve(true));
    });
    req.once("timeout", () => { req.destroy(); resolve(false); });
    req.once("error", () => resolve(false));
  });
}

(async () => {
  console.log(`Probing ${HOST}...`);
  if (await probeTcp()) { console.log("RESULT: TCP:100 responded — car speaks the binary protocol."); return; }
  if (await probeHttp()) { console.log("RESULT: HTTP:80 responded — car speaks the HTTP protocol."); return; }
  console.log("RESULT: neither port responded. Check you have joined ESP32-Car and try again.");
})();
'
```

Expected outcomes:
- `TCP:100 responded` — matches `docs/ACEBOTT QD001 - smart car - base/Python/5.Python Program/7.4APPControlCar.py` (the binary protocol the official phone app uses). This is the most likely result based on that firmware source.
- `HTTP:80 responded` — matches the alternative firmware in `7.3Web_control_car.py`.
- Neither responds — confirm you've actually joined `ESP32-Car` (not your home Wi-Fi) and that the car is powered on, then retry.

Whichever result you get, it should match what the app itself shows in its status area once ticket 04's UI exists; if it doesn't, that's a signal the app's probe logic or timeouts need adjusting for the real hardware.
