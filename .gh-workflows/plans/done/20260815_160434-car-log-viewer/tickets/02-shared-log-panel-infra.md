# 02 — Shared log-panel infrastructure (buffer, timestamp, render, clear)

**What to build:** a pure, shared byte-to-line buffering module that splits on newlines and prefixes each line with a timestamp; a pure, shared renderer module that appends timestamped lines to a live panel, caps the display at 500 lines, auto-scrolls to the latest entry, and includes a working Clear button that empties the panel. Add two new empty log-panel DOM elements to the existing single window (one for Wi-Fi Log, one for USB Log), each with its own Clear button, wired to the new renderer module with no live data source yet. These form the seam that both feature tickets below plug into.

**Blocked by:** None — can start immediately

**Status:** done

- [x] Pure buffering module created that accepts byte data, splits on newlines, and prefixes each line with ISO timestamp — `app/src/logLineBuffer.ts` (`LogLineBuffer.push()` + `formatLogTimestamp()`)
- [x] Buffering module exposed and testable with no dependencies on IPC or renderer context — no Electron import; 12 unit tests in `app/src/logLineBuffer.test.ts`
- [x] Pure renderer module created that appends formatted lines to a DOM element, caps at 500 lines, auto-scrolls, and includes Clear function — `app/src/logPanel.ts` (`appendLogLines()`, `clearLogLines()`, `renderLogPanel()`)
- [x] Renderer module exposed and testable with no dependencies on data source or IPC — `appendLogLines()`/`clearLogLines()` (the pure array core) have 10 unit tests in `app/src/logPanel.test.ts`, per spec.md's Testing Decisions. `renderLogPanel()` (the thin DOM-wiring part) is intentionally left to manual verification, per that same spec section — no DOM/jsdom test layer exists anywhere in this codebase yet, matching precedent.
- [x] Two new empty log-panel DOM elements added to the main window (Wi-Fi Log panel and USB Log panel) — `#wifi-log-panel`/`#usb-log-panel` in `app/public/index.html`, below the existing Shoot controls
- [x] Each panel has a distinct ID and a Clear button wired to the renderer's Clear function — `#wifi-log-clear-button`/`#usb-log-clear-button`, wired to `handleWifiLogClear()`/`handleUsbLogClear()` in `app/src/renderer.ts`
- [x] Both panels render correctly with empty/inert state — `renderWifiLog()`/`renderUsbLog()` called on load with empty arrays; confirmed no load-time JS errors via a brief real Electron launch (see notes)
- [x] Clear buttons work on both panels, removing all lines without error — `clearLogLines()` resets to `[]`, re-renders via `renderLogPanel()`; verified by code review + unit tests of the pure core (no live data exists yet to visually confirm clearing non-empty content — that lands with tickets 03/04)
- [x] Auto-scroll does not fire on empty panels — `renderLogPanel()` explicitly guards `scrollTop` assignment behind `lines.length > 0`, not left to `scrollTop`'s incidental at-zero behavior
