'use strict';

/** Tuya protocol versions supported by this app */
export type ProtocolVersion = '3.1' | '3.2' | '3.3' | '3.4' | '3.5' | 'auto';

/** Configuration required to connect to a Tuya device */
export interface TuyaDeviceConfig {
  host: string;
  deviceId: string;
  localKey: string;
  protocolVersion: ProtocolVersion;
  nodeId?: string | null;
  pollInterval?: number;
}

/** Raw datapoint state from a Tuya device */
export interface DpsState {
  [dp: string]: boolean | number | string;
}

/** Tuya device message payload */
export interface TuyaPayload {
  devId?: string;
  gwId?: string;
  uid?: string;
  t?: number | string;
  dps?: DpsState;
  dpId?: number[];
  data?: Record<string, unknown>;
}

/** Tuya command types */
export enum CommandType {
  UDP = 0,
  AP_CONFIG = 1,
  ACTIVE = 2,
  SESS_KEY_NEG_START = 3,
  SESS_KEY_NEG_RES = 4,
  SESS_KEY_NEG_FINISH = 5,
  UNBIND = 6,
  CONTROL = 7,
  STATUS = 8,
  HEART_BEAT = 9,
  DP_QUERY = 0x0a,
  QUERY_WIFI = 0x0b,
  TOKEN_BIND = 0x0c,
  CONTROL_NEW = 0x0d,
  ENABLE_WIFI = 0x0e,
  DP_QUERY_NEW = 0x10,
  SCENE_EXECUTE = 0x11,
  UPDATEDPS = 0x12,
  UDP_NEW = 0x13,
  AP_CONFIG_NEW = 0x14,
  LAN_GW_ACTIVE = 0x19,
  LAN_SUB_DEV_REQUEST = 0x1a,
  LAN_DELETE_SUB_DEV = 0x1b,
  LAN_REPORT_SUB_DEV = 0x1c,
  LAN_SCENE = 0x1d,
  LAN_PUBLISH_CLOUD_CONFIG = 0x1e,
  LAN_PUBLISH_APP_CONFIG = 0x1f,
  LAN_EXPORT_APP_CONFIG = 0x20,
  LAN_PUBLISH_SCENE_PANEL = 0x21,
  LAN_REMOVE_GW = 0x22,
  LAN_CHECK_GW_UPDATE = 0x23,
  LAN_GW_UPDATE = 0x24,
  LAN_SET_GW_CHANNEL = 0x25,
}

/** Parsed message from the Tuya protocol */
export interface TuyaMessage {
  seqNo: number;
  commandType: CommandType;
  payloadSize: number;
  returnCode: number;
  payload: Buffer;
  crc: number;
}

/** Transform functions for DP values */
export type TransformFunction =
  | 'divideBy10'
  | 'divideBy100'
  | 'divideBy1000'
  | 'multiplyBy10'
  | 'multiplyBy100'
  | 'multiplyBy1000'
  | 'booleanInvert';

/** Mapping from a Homey capability to a Tuya DP */
export interface CapabilityDpMapping {
  dp: string;
  transform?: TransformFunction;
  reverseTransform?: TransformFunction;
  valueMap?: Record<string, unknown>;
  reverseValueMap?: Record<string, unknown>;
}

/** A device profile that maps Homey capabilities to Tuya DPs */
export interface DeviceProfile {
  id: string;
  homeyClass: string;
  capabilities: string[];
  requiredDps: string[];
  optionalDps?: string[];
  mapping: Record<string, CapabilityDpMapping>;
}

/** Connection events emitted by TuyaConnection */
export interface ConnectionEvents {
  connected: () => void;
  disconnected: (error?: Error) => void;
  dps: (dps: DpsState) => void;
  error: (error: Error) => void;
}

/** Store payload persisted on Homey device */
export interface TuyaDeviceStore {
  host: string;
  device_id: string;
  protocol_version: ProtocolVersion;
  node_id: string | null;
  profile: string;
  mapping: Record<string, string>;
}

/** Settings for a Tuya device in Homey */
export interface TuyaDeviceSettings {
  host: string;
  device_id: string;
  local_key: string;
  protocol_version: ProtocolVersion;
  node_id?: string;
  poll_interval: number;
}
