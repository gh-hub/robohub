// Builds binary command frames for the ACEBOTT TCP:100 protocol, per
// ADR-001 (.gh-workflows/plans/20260814_195843-car-lights-control/grill/ADR-001.md):
//
//   Byte 0-1:   0xFF 0x55        (header)
//   Byte 2:     payload length   (always 0x0A / 10 for this frame shape)
//   Byte 3-12:  10-byte payload  — payload[6]=action, payload[7]=device,
//               payload[9]=value; every other payload byte is reserved and
//               zero-filled (unvalidated by the firmware parser)
//
// Generic across device/action/value combinations so it's the single
// reusable frame-builder for all future TCP:100 commands (movement, buzzer,
// servo, ...), not just LED — per ADR-001's stated intent.

const FRAME_HEADER_BYTES = [0xff, 0x55] as const;
const PAYLOAD_LENGTH = 10;
const PAYLOAD_ACTION_INDEX = 6;
const PAYLOAD_DEVICE_INDEX = 7;
const PAYLOAD_VALUE_INDEX = 9;

// Protocol-wide command action code. Only CMD_RUN is needed by this plan;
// other action codes (e.g. CMD_GET = 0x02) documented in ADR-001 are left
// undeclared until a future command actually needs them.
export const CMD_RUN = 0x01;

// Protocol-wide device code for the LED command this plan wires up. Other
// device codes (e.g. motor = 0x01) are left undeclared until a future
// command actually needs them.
export const DEVICE_LED = 0x05;

// Device code for direct motor control, reverse-engineered from the
// firmware's runModule() (see ADR-001 at
// .gh-workflows/plans/20260815_065830-car-movement-light-controls/grill/ADR-001.md).
export const DEVICE_MOTOR = 0x0c;

// Device code for the QD005 water gun's blaster trigger, reverse-engineered
// from the firmware's runModule() (see ADR-001 at
// .gh-workflows/plans/20260815_083408-water-gun-control/grill/ADR-001.md).
// The value byte is completely ignored by the firmware — any frame with
// this device code fires a fixed 200ms pulse regardless of value.
export const DEVICE_SHOOT = 0x08;

// Device code for the QD005 water gun's aim servo, reverse-engineered from
// the firmware's runModule() (see ADR-001 at
// .gh-workflows/plans/20260815_083408-water-gun-control/grill/ADR-001.md).
// The value byte is an absolute angle in degrees, 1-180 inclusive — the
// firmware maps it to a PWM value via map(angle, 1, 180, 130, 70).
export const DEVICE_SERVO = 0x02;

// Device code for the distance sensor's pan servo (the ultrasonic sensor
// bracket mounted on GPIO 25), placeholder pending firmware support — see
// .gh-workflows/plans/20260820_115614-distance-servo-pan-control/. Unlike
// DEVICE_SERVO/DEVICE_SHOOT/etc. above, this is NOT reverse-engineered from
// an existing runModule() handler: the firmware has no case for this device
// code yet, so any frame sent with it is silently ignored by the car until
// separate future work adds the handler and reflashes the firmware. The
// value byte is intended to be an absolute angle in degrees, 1-180
// inclusive, matching DEVICE_SERVO's convention once firmware support lands.
export const DEVICE_DISTANCE_SENSOR = 0x04;

// Convention-only placeholder value for shoot commands, per ADR-001: since
// the firmware ignores payload[9] entirely for device 0x08, this exists
// purely to give buildCommandFrame() an explicit, self-documenting value
// rather than a bare 0 at the call site.
export const SHOOT_VALUE = 0x00;

// One value byte per supported movement direction, per ADR-001's device/value
// table. The firmware also defines diagonals (0x05-0x08) — intentionally out
// of scope for this plan, so left undeclared.
export type MovementDirection =
  | "stop"
  | "forward"
  | "backward"
  | "left"
  | "right"
  | "rotate-left"
  | "rotate-right";

export const MOVEMENT_VALUES: Record<MovementDirection, number> = {
  stop: 0x00,
  forward: 0x01,
  backward: 0x02,
  left: 0x03,
  right: 0x04,
  "rotate-left": 0x09,
  "rotate-right": 0x0a,
};

export interface CommandFrameFields {
  action: number;
  device: number;
  value: number;
}

/**
 * Builds a single command frame ready to write to the TCP:100 socket.
 */
export function buildCommandFrame({ action, device, value }: CommandFrameFields): Buffer {
  const payload = Buffer.alloc(PAYLOAD_LENGTH, 0);
  payload[PAYLOAD_ACTION_INDEX] = action;
  payload[PAYLOAD_DEVICE_INDEX] = device;
  payload[PAYLOAD_VALUE_INDEX] = value;

  return Buffer.concat([Buffer.from([...FRAME_HEADER_BYTES, PAYLOAD_LENGTH]), payload]);
}
