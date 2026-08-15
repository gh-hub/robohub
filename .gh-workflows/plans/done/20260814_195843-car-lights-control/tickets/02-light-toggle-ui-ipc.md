# 02 — Left/Right Light toggle buttons, IPC, and mirrored renderer state

**What to build:** The complete user-facing light control feature: two "Left Light" and "Right Light" toggle buttons wired through IPC to the frame-sending layer, with optimistic state tracking that updates on click, disables when not connected on tcp100, and resets to "off" on every fresh connect/reconnect.

**Blocked by:** 01 — Command-frame protocol layer on CarConnection

**Status:** ready

- [x] Left Light and Right Light buttons added to app/public/index.html below Connect/Disconnect
- [x] Buttons share one mirrored on/off boolean state in renderer
- [x] Mirrored state updates optimistically on click
- [x] Buttons disabled when status != "connected" or protocol != "tcp100"
- [x] Mirrored state resets to "off" on every fresh connect and disconnect (also resets on `error`, per spec.md user story 7's "connection is lost or in error" — see notes)
- [x] IPC channel extended through carIpcHandlers.ts (CarConnectionLike interface)
- [x] IPC channel exposed on window.carAPI in preload.ts with resolve-on-initiate/reject-on-invalid contract
- [x] FakeCarConnection-based IPC handler tests cover all connect/disconnect/protocol scenarios
- [x] Pure-function UI-state-mapping tests cover all combinations of status/protocol against button enabled/disabled state

**Note on live-hardware verification:** as flagged in ticket 01's notes, this sandboxed environment has no
network reachability to the physical car's Wi-Fi AP, so the reverse-engineered ADR-001 frame format still
cannot be confirmed against real hardware from here. This ticket exposes the full path the user needs to do
that manual check themselves: `window.carAPI.setLights(true)` from devtools console (or clicking either
light button) once connected to the real QD001 over tcp100. See PROGRESS/notes/implement-02-light-toggle-ui-ipc.md
for details.
