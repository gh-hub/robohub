// Hardcoded car connection details. No settings UI exists for this app (see
// spec.md "Config as constants, not data") — update these directly if the
// car's IP/SSID/password ever changes.

export const CAR_IP = "192.168.4.1";
export const CAR_SSID = "ESP32-Car";

// Candidate ports probed in order: the binary protocol the official ACEBOTT
// phone app speaks (TCP:100), then the alternative example HTTP firmware
// (HTTP:80). Which one the physical car actually runs is unconfirmed — see
// the ticket's "Manual verification" section.
export const CAR_TCP_PORT = 100;
export const CAR_HTTP_PORT = 80;

// Per-port probe timeout. 2.5s is a reasonable default for a local Wi-Fi
// hotspot hop; adjust if real hardware testing shows it's too tight or slow.
export const CAR_PROBE_TIMEOUT_MS = 2500;

// The HTTP:80 example firmware (docs/.../7.3Web_control_car.py) closes its
// socket after every single request/response — there is no persistent
// connection to hold open and watch for close/error the way TCP:100 allows.
// A lightweight periodic GET / (side-effect-free, see probeHttp()'s comment
// in carConnection.ts) is the only available liveness signal for that path.
// 5s is a reasonable balance between prompt drop detection and not hammering
// the car's single-threaded firmware socket loop with requests.
export const CAR_HTTP_POLL_INTERVAL_MS = 5000;
