# Glossary: car-movement-light-controls

## Command frame
A binary message sent over TCP:100 to the car. Format: `0xFF 0x55 <length> <10-byte payload>`. The payload encodes an action, device, and value that the car's firmware interprets. See the base frame format documented in the previous plan's ADR-001 at `.gh-workflows/plans/done/20260814_195843-car-lights-control/grill/ADR-001.md`.

## Device code
A byte in the command frame's payload (at offset payload[7]) that specifies which subsystem the command targets. Examples: `0x05` (LED/lights), `0x0C` (motor/movement). The firmware's `runModule()` function dispatches on device code.

## Action code
A byte in the command frame's payload (at offset payload[6]) that specifies the class of command. `CMD_RUN (0x01)` is used for both lighting and movement commands (direct motor/LED control). Other action codes exist for other firmware modes (e.g., auto-drive modes), but are out of scope for this plan.

## Value byte
A byte in the command frame's payload (at offset payload[9]) that specifies the parameter to the action. For lights, 0 or 1 (off/on). For movement, a direction code: 0x00 (Stop), 0x01 (Forward), 0x02 (Backward), 0x03 (Left), 0x04 (Right), 0x09 (Rotate Left), 0x0A (Rotate Right).

## TCP:100 protocol
The command-channel protocol: TCP socket on port 100, using the binary command-frame format. Supports all movement and lighting commands. Active when `status === "connected" && protocol === "tcp100"`.

## HTTP:80 protocol
The status-polling fallback protocol: HTTP over port 80, read-only, only fetches connection/battery/sensor status. No command support (zero ability to send movement or lighting commands). Active when `status === "connected" && protocol === "http80"`.

## Arc turn
A movement where the car's body remains at a constant heading while one or both wheels drive, causing the car to curve left or right. Directions: Left (value 0x03) and Right (value 0x04). Opposite of pivot turn.

## Pivot turn
A movement where the car rotates in place by driving wheels on opposite sides in opposite directions. Directions: Rotate Left / Contrarotate (value 0x09, counter-clockwise) and Rotate Right / Clockwise (value 0x0A, clockwise). Opposite of arc turn.

## Active direction
The single-slot piece of renderer state that tracks which direction button (if any) is currently held down. When a new button is pressed, `activeDirection` is overwritten with the new direction, interrupting the previous one. When any Stop-trigger event occurs, Stop is only sent if it matches the currently-tracked `activeDirection`; a mismatched or already-cleared event is a no-op. This prevents a stale release from an old button from incorrectly stopping a newer, still-held direction.

## Watchdog (or watchdog timer)
A firmware mechanism that automatically stops a motor or clears a command if no fresh command is received within a timeout period (e.g., 3 seconds). This car's firmware **lacks a watchdog for direct CMD_RUN movement commands** — motors run forever once a direction is sent, until an explicit Stop (value 0x00) is sent. (The firmware does have a 3-second `lastDataTimes` timeout, but it only affects auto-drive modes like line-follow, not direct CMD_RUN commands.) This is the safety-critical fact that requires explicit Stop-on-pointerup, pointerleave, blur, and disconnect events.

## Interrupt semantics
The behavior where pressing a new direction button while another is held immediately sends the new direction (overriding the car's current motion), without waiting for the old button to be released. Contrasts with queueing (buffering the second press) or blocking (ignoring the second press). This plan uses interrupt semantics.

## Safety-trigger event
Any event that should cause an explicit Stop command to be sent (if a direction is currently active): `pointerup` (button released), `pointerleave` or `pointercancel` (pointer left the button while still held), `window.blur` (window lost focus, e.g., alt-tab), or connection drop (status left `connected`+`tcp100`). Sent only if the event corresponds to the currently-tracked `activeDirection`.
