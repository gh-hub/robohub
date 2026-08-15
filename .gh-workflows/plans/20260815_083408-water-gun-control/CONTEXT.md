# Context: water-gun-control

## What we're building
Connect the QD005 water gun / water ball launcher attachment to the ACEBOTT car control app. The QD005 has two functions to expose: (1) shoot — a shoot/fire button for the blaster trigger, and (2) aim movement — up and down buttons to control the aiming servo (GPIO 26). Hardware reference: /Users/gil-hadad/gilhadad.com/projects/robohub/docs/qd001-hardware-access/index.md, section 'QD005 Water Ball Launcher' and the QA052 shield header table (Shoot = 2-pin JST driven via unidentified U4 chip; Aiming servo = GPIO 26).

## Key decisions
(None yet — set during grill phase)

## Current state
Phase: grill
Completed tickets: none
Current ticket: none

## Load this session
- .gh-workflows/plans/20260815_083408-water-gun-control/tickets/ (when implement begins)
- coding-rules/ (skill defaults) + .gh-workflows/plans/coding-rules/ (project, if present)

## Gotchas
- Hardware reference includes both QD005 water ball launcher and QA052 shield header documentation
- GPIO 26 for servo control must be verified against existing hardware wiring
