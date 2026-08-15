# Glossary: car-lights-control

## Left Light / Right Light

The two physical LED modules on the QD001 car (GPIO2 and GPIO12). Source comments disagree on which pin is which side (firmware source says left=GPIO2, right=GPIO12, but video tutorial narration says left=GPIO12, right=GPIO2) — unconfirmed, low-stakes since both are driven identically by the current protocol.

## tcp100 protocol

The binary command protocol served on TCP port 100 by the car's "APP control" firmware, as opposed to `http80` (a movement-only HTTP fallback firmware). Terms established by the previous `acebott-control-app` plan; reused here.

## Mirrored toggle

The UI pattern used here where two visually-separate buttons always reflect and drive the same underlying shared state, because the hardware command they trigger isn't independently addressable. Both "Left Light" and "Right Light" buttons are mirrored: clicking either one sends the same LED-on/off command to the car, and both buttons always display the same state.

## Optimistic / app-tracked state

UI state that reflects "what the app last told the device" rather than a confirmed hardware readback — used here because the protocol has no query/response channel. When the user toggles a light, the UI immediately shows the new state locally (optimistically), but the app has no way to verify that the car's hardware actually changed, only that the command was sent.

