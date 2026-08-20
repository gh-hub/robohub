// Shared renderer-side log-panel logic (append-with-cap, render-and-
// auto-scroll, Clear), reused by both the Wi-Fi Log and USB Log panels per
// spec.md's "one small, reusable piece of log-panel logic shared by both
// panels" decision — the two panels differ only in which IPC subscription
// feeds them and which button drives their own connect/disconnect state
// (both out of scope for this ticket; wired up in tickets 03/04).
//
// Per spec.md's "Testing Decisions", only the pure append/cap/clear array
// logic below is unit-tested directly (input in, expected array out, no
// DOM). The DOM-wiring render function is left to manual testing, matching
// how the rest of the renderer already splits pure logic from DOM wiring
// (see connectionUiState.ts's mappers vs. renderer.ts's render*() functions).

/** Per spec.md's capped in-memory buffer decision: oldest lines dropped
 * first once a panel exceeds this many lines. */
export const MAX_LOG_PANEL_LINES = 500;

/**
 * Pure append-with-cap: returns a new array with `newLines` appended after
 * `existingLines`, trimmed from the front so the result never exceeds
 * `maxLines`. Does not mutate `existingLines`.
 */
export function appendLogLines(
  existingLines: readonly string[],
  newLines: readonly string[],
  maxLines: number = MAX_LOG_PANEL_LINES,
): string[] {
  const combined = [...existingLines, ...newLines];
  if (combined.length <= maxLines) {
    return combined;
  }
  return combined.slice(combined.length - maxLines);
}

/** Pure Clear: a panel's lines reset to empty, per spec.md's "own Clear
 * button" decision. Trivial, but named/exported so both the pure state
 * reset and the DOM re-render below share one obvious seam, the same shape
 * as `appendLogLines`. */
export function clearLogLines(): string[] {
  return [];
}

/**
 * Thin DOM-wiring layer: renders `lines` into `panelElement` and
 * auto-scrolls to the latest entry. Not part of the automated test suite
 * (per spec.md's Testing Decisions) — verified manually. Auto-scroll is
 * guarded to never fire on an empty panel (this ticket's acceptance
 * criterion), rather than relying on scrollTop's incidental no-op-at-zero
 * behavior.
 */
export function renderLogPanel(panelElement: HTMLElement, lines: readonly string[]): void {
  panelElement.textContent = lines.join("\n");

  if (lines.length > 0) {
    panelElement.scrollTop = panelElement.scrollHeight;
  }
}
