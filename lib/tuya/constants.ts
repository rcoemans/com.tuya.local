'use strict';

/** Default Tuya LAN port */
export const TUYA_PORT = 6668;

/** UDP broadcast port for device discovery */
export const TUYA_UDP_PORT = 6666;

/** UDP broadcast port for protocol 3.3+ discovery */
export const TUYA_UDP_PORT_33 = 6667;

/** Protocol framing constants */
export const PREFIX = Buffer.from('000055aa', 'hex');
export const SUFFIX = Buffer.from('0000aa55', 'hex');

/** Minimum message header size (prefix + seqno + cmd + length) */
export const HEADER_SIZE = 16;

/** CRC + suffix size */
export const FOOTER_SIZE = 8;

/** Heartbeat interval in milliseconds */
export const HEARTBEAT_INTERVAL = 10_000;

/** Heartbeat timeout in milliseconds */
export const HEARTBEAT_TIMEOUT = 5_000;

/** Default poll interval in seconds */
export const DEFAULT_POLL_INTERVAL = 30;

/** Default reconnect base delay in milliseconds */
export const RECONNECT_BASE_DELAY = 1_000;

/** Maximum reconnect delay in milliseconds */
export const RECONNECT_MAX_DELAY = 60_000;

/** Socket connect timeout in milliseconds */
export const CONNECT_TIMEOUT = 10_000;

/** Command response timeout in milliseconds */
export const COMMAND_TIMEOUT = 5_000;

/** Protocol version strings mapped to their numeric identifiers */
export const PROTOCOL_VERSIONS: Record<string, number> = {
  '3.1': 31,
  '3.2': 32,
  '3.3': 33,
  '3.4': 34,
  '3.5': 35,
};

/** UDP key for decrypting 3.1 UDP discovery messages */
export const UDP_KEY = Buffer.from('6c1ec8e2bb9bb59ab50b0daf649b410a', 'hex');

/** Known Tuya Wi-Fi MAC prefixes (OUI bytes) for assisted discovery */
export const TUYA_MAC_PREFIXES: number[][] = [
  [0x84, 0xf0, 0x58],
  [0x50, 0xe8, 0x91],
  [0xd8, 0x1f, 0x12],
  [0x68, 0x57, 0x2d],
  [0xa0, 0x92, 0x08],
  [0x70, 0x3e, 0x97],
];
