# Grill phase: car-movement-light-controls

## Interview summary

The grill phase interview gathered requirements for two interconnected features:

1. **Lights simplification**: Collapse two redundant "Left Light"/"Right Light" toggle buttons into a single "Lights" button. The wire protocol uses only one LED and a single shared command; the two-button UI adds no functional value. No protocol or IPC changes — only HTML and renderer wiring change.

2. **Movement control**: Add six press-and-hold direction buttons (Forward, Backward, Left, Right, Rotate Left, Rotate Right) to drive the car. The protocol was reverse-engineered from the ACEBOTT QD001 reference firmware (Arduino and Python implementations, byte-identical): device 0x0C, action CMD_RUN (reused from lights), value byte per direction (Stop 0x00, Forward 0x01, Backward 0x02, Left 0x03, Right 0x04, Rotate Left 0x09, Rotate Right 0x0A).

## Key decisions resolved

### Interaction model
The user explicitly chose **press-and-hold with safety stops** over two alternatives:
1. Mouseup-only stop (rejected — leaves motors running if pointer leaves button or window loses focus).
2. Click-to-toggle (rejected — requires two clicks per motion, unresponsive to user intent, no real-time visual feedback).

The chosen model sends the direction on `pointerdown` and Stop on `pointerup`, `pointerleave`/`pointercancel` while held, `window.blur`, or disconnect. This is necessary because the firmware has no auto-stop watchdog for CMD_RUN commands — motors run forever until an explicit Stop arrives.

### Layout
The user explicitly chose **D-pad layout** (Forward/Backward/Left/Right in a cross, Rotate buttons below) over a single horizontal row of six buttons. This is more intuitive and mirrors the car's physical form factor.

### IPC architecture
One parameterized `car:set-movement` channel (not six separate channels), matching the pattern established in the lights plan with `car:set-lights`.

### Interrupt semantics
When a new direction button is pressed while another is held, the new press immediately sends its direction (overriding motion). A release event only sends Stop if it matches the currently-tracked active direction — preventing a stale release from an old button from incorrectly stopping a new, still-held direction.

## Next phase: spec

The spec phase will formalize the interaction model and code structure into a detailed specification document, identifying all files to be created/modified and the exact code signatures and test cases required.
