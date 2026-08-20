# 03 — [spec] Document LogLineBuffer's pending-buffer size cap in spec.md

**What to build:** Round 1's security fix added a maximum size cap to `LogLineBuffer`'s internal `pending` buffer (`app/src/logLineBuffer.ts`, `MAX_PENDING_LENGTH`) — when a chunk stream with no newline exceeds this cap, the buffered partial data is discarded rather than growing unbounded. This is a deliberate, justified security fix (closing an unbounded-memory-growth DoS), but spec.md's "Implementation Decisions" section (the buffering bullet about the module that "buffers partial data and splits on newline boundaries itself, discarding the carriage-return byte") doesn't mention it, so it currently reads as undocumented scope creep. This is a docs-only fix: add a sentence to spec.md's Implementation Decisions, in or near the existing buffering bullet, describing the size cap and its rationale (bounding memory against a peer that never sends a newline). No code change is needed — the behavior itself is correct and already implemented and tested from round 1's fix.

**Blocked by:** None — can start immediately.

- [x] `.gh-workflows/plans/20260815_160434-car-log-viewer/spec.md`'s Implementation Decisions section documents the `LogLineBuffer` pending-buffer size cap and why it exists
- [x] No production code is changed by this ticket
