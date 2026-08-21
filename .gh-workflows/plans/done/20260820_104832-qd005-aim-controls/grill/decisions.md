# Decisions: QD005 Aim Controls

## Decision: Rename, not new feature
Decided: This is purely a rename of the existing servo control from "Pan Left/Right" to "Aim Up/Down" across all layers, with zero changes to protocol, wire format, angle bounds, or control behavior. GPIO 26 / device code 0x02 is the one and only app-reachable vertical aim axis; there is no second reachable servo to discover or implement.

Why: The original design assumed horizontal panning motion, which was incorrect. Hardware investigation by the user confirms the servo physically moves vertically (up and down). Renaming resolves the confusion without requiring new protocol implementation or breaking existing behavior.

Alternatives rejected: Building a separate new feature or discovering/implementing a second servo axis (out of scope and not reachable from the app).

## Decision: Direction-sign as unverified placeholder
Decided: Up = increases the servo angle toward 180; Down = decreases toward 1. This direction is explicitly unverified pending real hardware calibration and must be flagged in code comments. It is easy to flip later (single delta-map constant).

Why: The user does not yet know the true physical direction from calibration but is satisfied deferring this until the app is deployed against real hardware. Having a direction decision now unblocks the rename work; calibration can flip the sign later without re-renaming.

Alternatives rejected: Deferring the direction sign entirely (would require runtime calibration discovery or user-facing direction-selection UI, adding complexity not warranted at this stage).

## Decision: New UI grouping with boxed visual treatment
Decided: Introduce a `<section>` titled "QD005 Water Gun" that visually boxes together the (renamed) Aim Up/Down controls and the existing Shoot controls. Use bordered/boxed styling modeled after the app's existing `.log-panel-container` pattern (border, heading, contained group).

Why: The QD005 servo and shoot trigger are currently scattered as flat, undifferentiated `<div>`s mixed in visually with the car's own Movement/Lights controls, creating no visual signal that "these are the water-gun attachment's controls." Grouping them under a labeled section makes the UI structure clearer and establishes a visual pattern for future attachment-specific controls.

Alternatives rejected: Leaving controls flat and ungrouped (no visual clarity); putting controls in separate top-level sections (increases visual fragmentation); using a different visual pattern (the existing `.log-panel-container` pattern is already established and accessible).

## Decision: Section placement (no reordering)
Decided: The new QD005 section occupies the same page position as the current two divs—after `#movement-controls`, before `#log-panels`. No reordering of other page elements.

Why: Preserves visual flow and user familiarity; the controls already exist in this location, so no workflow disruption. Changing placement would require design justification unrelated to this rename work.

Alternatives rejected: Moving the section to a different position on the page (introduces unnecessary disruption); creating a separate "attachments" section elsewhere (out of scope for this rename-focused change).

## Decision: Button glyphs (up/down triangles for visual consistency)
Decided: Aim buttons use ▲ Up / ▼ Down (`&#9650;` / `&#9660;`), reusing the exact same triangle glyphs already used by the D-pad's `#move-forward`/`#move-backward` buttons. Replace the old Pan glyphs ◀/▶ (`&#9664;`/`&#9654;`).

Why: The triangle glyphs are semantically correct for up/down motion and visually consistent with the established D-pad idiom, reducing cognitive load and unifying the UI language. The old left/right glyphs were correct for the mistaken "panning" assumption but wrong for vertical motion.

Alternatives rejected: Keeping the old left/right glyphs (semantically wrong); using different symbols (inconsistent with D-pad convention); using text labels instead of glyphs (adds verbosity and removes visual efficiency).
