// Shared byte-to-line buffering + timestamping module, per spec.md's "Wi-Fi
// log emission path" and "USB-serial-owning module" decisions: both the
// tcp100 socket-log emitter (ticket 03) and the USB serial-log emitter
// (ticket 04) reuse this one module rather than duplicating the
// buffer/newline-split/timestamp logic. Framework-free (no Electron/IPC
// dependency) so it's directly unit-testable and reusable from the main
// process, mirroring commandFrame.ts's/carConnection.ts's existing
// "pure/injectable, no Electron import" precedent.

function pad(value: number, width: number): string {
  return String(value).padStart(width, "0");
}

/**
 * Maximum length, in UTF-16 code units, the internal buffered partial line
 * (`pending`) may hold while waiting for its terminating `\n`. Any real log
 * line is at most a few hundred characters, so this generous multi-KB cap
 * never truncates legitimate output; it exists to bound memory against an
 * untrusted or malfunctioning peer (the tcp100 socket has no TLS, so a
 * LAN attacker able to spoof the car's endpoint could hold it open, and a
 * malfunctioning USB-serial device could do the same) that streams bytes
 * with no newline for the lifetime of a session.
 */
export const MAX_PENDING_LENGTH = 16 * 1024;

/**
 * Formats a receipt timestamp as `[HH:MM:SS.mmm]` in local time, per spec.md
 * user story 16's example (`[14:32:05.123]`) — an ISO-8601 time-only
 * representation, wrapped in brackets.
 */
export function formatLogTimestamp(date: Date): string {
  const hours = pad(date.getHours(), 2);
  const minutes = pad(date.getMinutes(), 2);
  const seconds = pad(date.getSeconds(), 2);
  const milliseconds = pad(date.getMilliseconds(), 3);
  return `[${hours}:${minutes}:${seconds}.${milliseconds}]`;
}

/**
 * Buffers a potentially endless incoming byte/string stream and splits it
 * into discrete, timestamped lines on `\n` boundaries, discarding the
 * trailing `\r` byte `Serial.println()`-style output adds. A partial line
 * still sitting in the internal buffer after `push()` returns is retained,
 * not flushed — per spec.md, there's no guaranteed frame boundary to trust
 * it as complete; callers that need to discard it (e.g. on session end)
 * simply stop calling `push()` and drop the instance, rather than calling an
 * explicit flush. That retained partial line is capped at
 * `MAX_PENDING_LENGTH`: if no newline arrives before the cap is hit, the
 * buffered data is discarded (never emitted as a truncated line) and
 * buffering resumes fresh from the next chunk, so a peer that never sends a
 * newline cannot grow memory without bound.
 *
 * The receipt timestamp is read once per `push()` call (not once per emitted
 * line) — every line completed by the same chunk of incoming data shares one
 * receipt time, which matches spec.md's "rough sense of timing" framing
 * without pretending to sub-chunk precision the underlying transport doesn't
 * provide.
 */
export class LogLineBuffer {
  private pending = "";
  private readonly now: () => Date;

  constructor(now: () => Date = () => new Date()) {
    this.now = now;
  }

  push(chunk: Buffer | string): string[] {
    this.pending += typeof chunk === "string" ? chunk : chunk.toString("utf8");

    const segments = this.pending.split("\n");
    this.pending = segments.pop() ?? "";
    if (this.pending.length > MAX_PENDING_LENGTH) {
      // No newline arrived before the cap was hit, so this partial data can
      // never become a complete, trustworthy line — discard it and resume
      // buffering fresh from the next chunk rather than growing forever.
      this.pending = "";
    }
    if (segments.length === 0) {
      return [];
    }

    const timestamp = formatLogTimestamp(this.now());
    return segments.map((segment) => `${timestamp} ${segment.replace(/\r$/, "")}`);
  }
}
