# Grill phase notes

## What was gathered

The grill phase interview confirmed:

1. **Rename scope**: The QD005 water gun servo (GPIO 26, device code 0x02) is the one and only app-reachable vertical aim axis. The current codebase mislabels it as "Pan Left/Right" due to an earlier incorrect assumption. A second firmware servo (GPIO 25) exists but is internal-only and unreachable from the app. This work is purely a rename, not a new feature.

2. **Identifier inventory**: Compiled a complete list of identifiers to rename across all layers: protocol comments, UI-state mapper, IPC channels, preload bridge, main-process wiring, IPC handlers, connection class methods, renderer DOM/state logic, HTML markup/ids/CSS, and test files.

3. **Direction sign (unverified)**: Up increases angle toward 180°; Down decreases toward 1°. This is a placeholder awaiting hardware calibration. Must be flagged in code comments as unverified; easy to flip later via single constant.

4. **UI grouping**: Introduction of a boxed "QD005 Water Gun" section grouping Aim + Shoot controls together, styled after the existing `.log-panel-container` pattern (border, heading, contained group). Placement: after `#movement-controls`, before `#log-panels`.

5. **Button glyphs**: Use triangle glyphs ▲ Up / ▼ Down (`&#9650;` / `&#9660;`) for visual consistency with D-pad forward/backward buttons. Replace old Pan glyphs ◀/▶.

6. **Out of scope**: No changes to protocol/wire format, no behavior changes to Shoot, no touching GPIO 25, no hardware calibration.

## What's next (spec phase)

The spec phase will:
1. Decompose the rename into implementation tickets covering the nine source files and three test files (or group logically).
2. Specify the exact HTML/CSS structure for the new QD005 section.
3. Define any new test cases for the UI grouping (if not covered by existing tests).
4. Document the unverified direction-sign flag to go into code comments.

No new ADR needed — the prior plan's ADR-001.md (protocol discovery) remains accurate; only the app's identifier/naming changes, not the protocol facts.
