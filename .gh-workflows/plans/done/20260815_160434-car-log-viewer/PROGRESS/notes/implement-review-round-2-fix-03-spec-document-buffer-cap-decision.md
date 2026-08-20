# Notes: implement/review-round-2-fix-03-spec-document-buffer-cap-decision

`spec.md`'s Implementation Decisions section was updated to document `LogLineBuffer`'s `MAX_PENDING_LENGTH` pending-buffer size cap (added in round-1's security fix) and its rationale: bounding memory against a peer — misbehaving car firmware, or a spoofed/malicious peer on the unauthenticated tcp100 socket — that never sends a newline, which would otherwise grow the buffer without bound. No production code was changed; `app/src/logLineBuffer.ts`'s existing behavior (discard `pending` when it exceeds the cap without a newline) was only read for accuracy, not modified.

All three round-2 fix tickets are now complete (security: batch log-line emission; spec: close port on error event; spec: document buffer-cap decision). Review round 3 is next.
