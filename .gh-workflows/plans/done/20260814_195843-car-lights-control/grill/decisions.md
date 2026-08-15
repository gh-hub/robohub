# Decisions: car-lights-control

## Decision: No firmware changes — WiFi-only control

Decided: This plan will not modify or reflash the car's ESP32 firmware; light control must work using only the existing WiFi/TCP:100 protocol as-is.

Why: The user explicitly ruled out changing car-side code, wants control purely via the app's existing WiFi connection. This keeps the project scope tight and avoids the complexity of firmware development, USB drivers, Arduino IDE setup, and testing against custom-compiled binaries.

Alternatives rejected: Extending the firmware to add two independent LED device codes (one per GPIO pin) and reflashing over USB was explored in depth as the initially-recommended path. It is technically feasible — a small change, not a rewrite — and the user confirmed they have a working Arduino IDE + USB driver setup already. However, the user explicitly preferred to avoid car-side code changes entirely, ruling it out in favor of WiFi-only control.

---

## Decision: Two toggle buttons, mirrored behavior

Decided: UI shows two separate toggle buttons, "Left Light" and "Right Light", but since the firmware only exposes one shared on/off command for both LEDs, clicking either button sends the identical command and both buttons' displayed state stay in sync/mirrored with each other.

Why: Preserves the two-button UI shape originally requested, while being honest about what the hardware protocol can actually do without firmware changes. The mirrored-button pattern makes the constraint transparent to the user: they see two buttons but understand they're controlling the same hardware command.

Alternatives rejected: A single combined "Lights" toggle button instead of two separate ones — rejected in favor of keeping two buttons per the original request, even though they're functionally mirrored.

---

## Decision: App-tracked (optimistic) state, not hardware-read

Decided: The toggle buttons' on/off display state is tracked entirely by the app (what it last commanded the car), not queried from the car.

Why: The protocol has no state-readback/query channel at all (confirmed in both example firmware source code and the user's own real hardware flash dump). Building a genuine hardware state query/response mechanism into the firmware would be significantly more work and would require firmware changes, ruled out by Decision 1 (no firmware changes) anyway.

Alternatives rejected: None — the protocol simply does not support state readback, making app-tracked state the only viable option.

---

## Decision: Reset assumed state to "off" on every connect/reconnect

Decided: Both toggles display "off" immediately after any fresh connect or reconnect, regardless of what they showed before a prior disconnect.

Why: Simple, consistent, matches the existing app's precedent of treating a fresh connection as a blank slate. Avoids the complexity of persisting state across reconnections.

Accepted tradeoff: If the car's physical lights were left on from a previous session, the display will be wrong until the user manually toggles. This is acceptable because: (a) the app has no way to know the car's actual state (no query channel exists), and (b) the user controls both the app and the car, so manual recovery is straightforward.

Alternatives rejected: Preserving last-known toggle state locally across reconnects — rejected because it could just as easily be wrong (e.g. if the car itself power-cycled) and adds complexity for no reliably-correct benefit.

---

## Decision: UI placement and connection-gating

Decided: New row/section in the existing single-window app, below the current Connect/Disconnect button and status text. Both light toggle buttons are disabled (grayed out) whenever the car is not connected.

Why: Matches the existing app's pattern of gating interactive controls on connection state; sending a light command requires an active connection to the car.

Alternatives rejected: Always-visible/clickable buttons that fail silently when disconnected — rejected in favor of the disabled-state pattern, which makes the constraint explicit to the user.

---

## Decision: Light control gated to the tcp100 protocol

Decided: Light toggle buttons are only enabled/functional when the active connection's negotiated protocol is `tcp100` (per `ConnectionState.protocol`), not `http80`.

Why: The HTTP:80 fallback firmware has zero LED support (movement only) — sending a light command over an http80 session would have nowhere to go. The user's physical car has been confirmed via flash-dump analysis to actually speak tcp100, so this is mostly a defensive/correctness detail.

Alternatives rejected: None explicitly discussed — presented as part of the final confirmation summary and accepted without objection.

---

## Decision: New command-sending capability added to the main-process car-connection layer

Decided: Extend the existing `CarConnection` class (or an adjacent main-process module) with the ability to build and send a binary command frame over the already-open TCP:100 socket, rather than introducing a new architecture. The renderer talks to it via new IPC channels (request-style, similar to the existing connect/disconnect channels), following the established ADR-002 pattern (main process owns all socket I/O; renderer never touches raw sockets).

Why: Consistent with the existing app's architecture and precedent from the previous plan; avoids introducing a second communication pathway. Keeps the socket I/O centralized in the main process where it belongs.

See [ADR-001.md](ADR-001.md) for the binary command frame format, which is documented as the wire protocol that future work (movement commands, buzzer, servo) will also need to use.

Alternatives rejected: None discussed — natural continuation of established architecture.

---

