import { EventEmitter } from "node:events";
import * as http from "node:http";
import * as net from "node:net";

import {
  CAR_HTTP_PORT,
  CAR_HTTP_POLL_INTERVAL_MS,
  CAR_IP,
  CAR_PROBE_TIMEOUT_MS,
  CAR_SSID,
  CAR_TCP_PORT,
} from "./carConfig.ts";
import { buildCommandFrame, CMD_RUN, DEVICE_LED } from "./commandFrame.ts";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

export type CarProtocol = "tcp100" | "http80";

export interface ConnectionState {
  status: ConnectionStatus;
  protocol: CarProtocol | null;
  message: string | null;
}

export interface CarConnectionOptions {
  host?: string;
  ssid?: string;
  tcpPort?: number;
  httpPort?: number;
  timeoutMs?: number;
  httpPollIntervalMs?: number;
}

const DISCONNECTED_STATE: ConnectionState = {
  status: "disconnected",
  protocol: null,
  message: null,
};

/**
 * Owns a single connection attempt/session to the car. Framework-free (no
 * Electron dependency) so it can run directly under node:test and be reused
 * by the main process later.
 *
 * Protocol note: the TCP:100 path keeps its `net.Socket` open for the life
 * of the session, so drops are detected via the socket's own `close`/`error`
 * events (no polling). The HTTP:80 firmware (see docs/.../7.3Web_control_car.py)
 * closes its socket after every request/response — there is no persistent
 * connection to hold open, so no event-based primitive exists for that path.
 * As an explicit, narrow exception, an http80 session instead runs a
 * lightweight periodic liveness GET (see `startHttpLivenessPolling()`).
 *
 * Unlike TCP's `close` event — which fires with `hadError: false` on a clean
 * FIN even for an unexpected drop, giving a real "clean vs. abrupt" signal —
 * a one-shot poll GET that fails (connection refused, timeout, DNS failure,
 * socket error) carries no such distinction: the car simply didn't answer.
 * That's inherently an abrupt/unexpected event, so a failed poll always
 * transitions to `error`, never `disconnected` (see `checkHttpLiveness()`).
 * `disconnected` is still reachable for an http80 session, but only via the
 * user's own `disconnect()` call — the one genuinely clean path.
 */
export class CarConnection extends EventEmitter {
  private readonly host: string;
  private readonly ssid: string;
  private readonly tcpPort: number;
  private readonly httpPort: number;
  private readonly timeoutMs: number;
  private readonly httpPollIntervalMs: number;

  private state: ConnectionState = { ...DISCONNECTED_STATE };
  private socket: net.Socket | null = null;
  private httpPollTimer: NodeJS.Timeout | null = null;
  private httpPollInFlight = false;

  constructor(options: CarConnectionOptions = {}) {
    super();
    this.host = options.host ?? CAR_IP;
    this.ssid = options.ssid ?? CAR_SSID;
    this.tcpPort = options.tcpPort ?? CAR_TCP_PORT;
    this.httpPort = options.httpPort ?? CAR_HTTP_PORT;
    this.timeoutMs = options.timeoutMs ?? CAR_PROBE_TIMEOUT_MS;
    this.httpPollIntervalMs = options.httpPollIntervalMs ?? CAR_HTTP_POLL_INTERVAL_MS;
  }

  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Probes TCP:100 first, then HTTP:80, and settles once one succeeds or
   * both fail. Rejects synchronously (before any I/O) if a connection
   * attempt is already in flight or already connected.
   */
  async connect(): Promise<void> {
    if (this.state.status === "connecting" || this.state.status === "connected") {
      throw new Error(`connect() called while status is "${this.state.status}"`);
    }

    this.setState({ status: "connecting", protocol: null, message: null });

    const connectedViaTcp = await this.probeTcpAndHold();
    if (connectedViaTcp) {
      this.setState({
        status: "connected",
        protocol: "tcp100",
        message: `Connected to ${this.host}:${this.tcpPort} (TCP)`,
      });
      return;
    }

    const connectedViaHttp = await probeHttp(this.host, this.httpPort, this.timeoutMs);
    if (connectedViaHttp) {
      this.setState({
        status: "connected",
        protocol: "http80",
        message: `Connected to ${this.host}:${this.httpPort} (HTTP)`,
      });
      this.startHttpLivenessPolling();
      return;
    }

    this.setState({
      status: "error",
      protocol: null,
      message:
        `Car unreachable at ${this.host} on TCP:${this.tcpPort} or HTTP:${this.httpPort}. ` +
        `Check that you've joined the "${this.ssid}" Wi-Fi network.`,
    });
  }

  /** Cleanly ends an active session. Rejects if not currently connected. */
  async disconnect(): Promise<void> {
    if (this.state.status !== "connected") {
      throw new Error(`disconnect() called while status is "${this.state.status}"`);
    }

    this.stopHttpLivenessPolling();

    if (this.socket) {
      // destroy(), not end(): end() only half-closes the write side and
      // waits for the peer to close its side too, which the car's firmware
      // has no reason to do on its own. A user-initiated disconnect must
      // deterministically reach "disconnected" without depending on the
      // remote cooperating.
      this.socket.destroy();
      return;
    }

    this.setState({ ...DISCONNECTED_STATE });
  }

  /**
   * Sends an already-built binary command frame (see commandFrame.ts /
   * ADR-001) over the currently-open TCP socket. Commands only make sense
   * on a live tcp100 session — http80 has no command channel at all, and a
   * disconnected/connecting/error session has no socket to write to — so
   * every other state rejects synchronously before any write is attempted.
   */
  async sendCommandFrame(frame: Buffer): Promise<void> {
    if (this.state.status !== "connected" || this.state.protocol !== "tcp100" || !this.socket) {
      throw new Error(
        `sendCommandFrame() called while status is "${this.state.status}" and protocol is "${this.state.protocol}"`,
      );
    }

    const socket = this.socket;
    await new Promise<void>((resolve, reject) => {
      socket.write(frame, (err) => {
        if (err) {
          reject(err);
          return;
        }
        resolve();
      });
    });
  }

  /**
   * Convenience wrapper over `sendCommandFrame()` for the one command this
   * plan wires end-to-end: the car's single shared LED on/off command (see
   * spec.md — the protocol has no independent left/right addressing, so
   * both light buttons funnel through this one call).
   */
  async setLedState(on: boolean): Promise<void> {
    await this.sendCommandFrame(
      buildCommandFrame({ action: CMD_RUN, device: DEVICE_LED, value: on ? 1 : 0 }),
    );
  }

  /**
   * Attempts a bare TCP handshake to the car's binary-protocol port. No
   * bytes are written — connecting alone is enough to confirm the port is
   * live, and the car's firmware (see server.accept() in
   * 7.4APPControlCar.py) requires no handshake payload, so this has no
   * movement side effects.
   *
   * The same `error`/`close` listeners are attached from socket creation
   * onward and reused for the post-connect session, so there is never a
   * window where the socket has zero listeners (an unhandled `error` event
   * on a `net.Socket` crashes the process).
   */
  private probeTcpAndHold(): Promise<boolean> {
    return new Promise((resolve) => {
      const socket = new net.Socket();
      let probeSettled = false;

      const settleProbe = (success: boolean) => {
        if (probeSettled) {
          return;
        }
        probeSettled = true;
        resolve(success);
      };

      socket.setTimeout(this.timeoutMs);

      socket.once("connect", () => {
        socket.setTimeout(0);
        this.socket = socket;
        settleProbe(true);
      });

      socket.once("timeout", () => {
        settleProbe(false);
        socket.destroy();
      });

      socket.once("error", (err: Error) => {
        if (!probeSettled) {
          settleProbe(false);
          return;
        }
        this.handleSocketError(err);
      });

      socket.once("close", (hadError: boolean) => {
        if (probeSettled && this.socket === socket) {
          this.handleSocketClose(hadError);
        }
      });

      socket.connect(this.tcpPort, this.host);
    });
  }

  private handleSocketError(err: Error): void {
    this.setState({
      status: "error",
      protocol: null,
      message: `Connection error: ${err.message}`,
    });
  }

  private handleSocketClose(hadError: boolean): void {
    this.socket = null;
    if (!hadError) {
      this.setState({ ...DISCONNECTED_STATE });
    }
  }

  /**
   * The only liveness signal available for an http80 session (see class doc
   * comment): a periodic re-run of the same side-effect-free GET / used to
   * probe the connection initially. `httpPollInFlight` guards against a slow
   * request overlapping the next interval tick and stacking up sockets.
   */
  private startHttpLivenessPolling(): void {
    this.httpPollTimer = setInterval(() => {
      void this.checkHttpLiveness();
    }, this.httpPollIntervalMs);
  }

  private async checkHttpLiveness(): Promise<void> {
    if (this.httpPollInFlight) {
      return;
    }
    this.httpPollInFlight = true;
    try {
      const stillAlive = await probeHttp(this.host, this.httpPort, this.timeoutMs);
      // The session may have been manually disconnected (or already marked
      // dropped by an earlier tick) while this GET was in flight — only act
      // if it's still the same live http80 session.
      if (stillAlive || this.state.status !== "connected" || this.state.protocol !== "http80") {
        return;
      }
      this.stopHttpLivenessPolling();
      // No clean-disconnect signal exists over one-shot HTTP polling (unlike
      // TCP's close event, which distinguishes a graceful FIN from an RST).
      // A poll going unanswered is always an unexpected drop, so it always
      // routes to "error" — "disconnected" for an http80 session is reached
      // only through the user's own disconnect() call.
      this.setState({
        status: "error",
        protocol: null,
        message: `Car stopped responding at ${this.host}:${this.httpPort} (HTTP).`,
      });
    } finally {
      this.httpPollInFlight = false;
    }
  }

  private stopHttpLivenessPolling(): void {
    if (this.httpPollTimer) {
      clearInterval(this.httpPollTimer);
      this.httpPollTimer = null;
    }
  }

  private setState(next: ConnectionState): void {
    this.state = next;
    this.emit("state-change", next);
  }
}

/**
 * A single HTTP GET used both to confirm the HTTP:80 firmware is present
 * during the initial probe, and (via `checkHttpLiveness()`) re-run on an
 * interval as that session's only drop-detection signal, since the firmware
 * closes its socket after every request. Deliberately requests `/` rather
 * than `/Car?move=...` — per the example firmware
 * (docs/.../7.3Web_control_car.py) only a `/Car?move=` path triggers
 * movement, so a bare `/` gets the status page with no side effects, safe to
 * repeat indefinitely.
 */
function probeHttp(host: string, port: number, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    let settled = false;
    const settle = (success: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(success);
    };

    const request = http.get({ host, port, path: "/", timeout: timeoutMs }, (response) => {
      response.resume();
      response.once("end", () => settle(true));
    });

    request.once("timeout", () => {
      settle(false);
      request.destroy();
    });

    request.once("error", () => {
      settle(false);
    });
  });
}
