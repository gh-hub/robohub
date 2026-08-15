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
