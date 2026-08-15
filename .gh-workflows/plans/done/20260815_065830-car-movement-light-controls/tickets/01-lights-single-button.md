# 01 — Lights: consolidate to a single button

**What to build:** Replace the two light buttons (`light-left-button`/`light-right-button`) in the UI with one `Lights` button. Collapse the renderer's dual click listeners and `renderLights()` render logic to match one button's worth of wiring, still backed by the existing mirrored `lightsOn` boolean and `window.carAPI.setLights()`. No protocol/IPC/backend changes — nothing there needs to change.

**Blocked by:** None — can start immediately

**Status:** done

- [x] Single Lights button replaces the two existing buttons in the HTML
- [x] Clicking the button toggles the LED via the existing `setLights()` API
- [x] Renderer state/rendering logic updated to match single-button model
- [x] Demoable — click Lights, LED toggles exactly as before but with one button (verified via full local build + test suite; manual hardware click-through not run in this session — see notes)
