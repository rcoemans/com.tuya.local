'use strict';

import type { DpsState, DeviceProfile, CapabilityDpMapping, TransformFunction } from './types';

/** Apply a transform to a DP value for reading into Homey */
function applyTransform(value: unknown, transform?: TransformFunction): unknown {
  if (transform === undefined || value === undefined || value === null) return value;

  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) return value;

  switch (transform) {
    case 'divideBy10': return num / 10;
    case 'divideBy100': return num / 100;
    case 'divideBy1000': return num / 1000;
    case 'multiplyBy10': return num * 10;
    case 'multiplyBy100': return num * 100;
    case 'multiplyBy1000': return num * 1000;
    case 'booleanInvert': return !value;
    default: return value;
  }
}

/** Apply a reverse transform for writing from Homey to DP */
function applyReverseTransform(value: unknown, transform?: TransformFunction): unknown {
  if (transform === undefined || value === undefined || value === null) return value;

  const num = typeof value === 'number' ? value : Number(value);
  if (isNaN(num)) return value;

  switch (transform) {
    case 'divideBy10': return Math.round(num * 10);
    case 'divideBy100': return Math.round(num * 100);
    case 'divideBy1000': return Math.round(num * 1000);
    case 'multiplyBy10': return Math.round(num / 10);
    case 'multiplyBy100': return Math.round(num / 100);
    case 'multiplyBy1000': return Math.round(num / 1000);
    case 'booleanInvert': return !value;
    default: return value;
  }
}

/**
 * Convert Tuya DPS values to Homey capability values.
 * Returns a map of capabilityId -> value.
 */
export function dpToCapability(
  dps: DpsState,
  mapping: Record<string, CapabilityDpMapping>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [capabilityId, config] of Object.entries(mapping)) {
    const dpValue = dps[config.dp];
    if (dpValue === undefined) continue;

    let value: unknown = dpValue;

    // Apply value map if present
    if (config.valueMap && typeof dpValue === 'string') {
      value = config.valueMap[dpValue] ?? dpValue;
    }

    // Apply transform
    value = applyTransform(value, config.transform);

    result[capabilityId] = value;
  }

  return result;
}

/**
 * Convert a Homey capability value to a Tuya DPS command.
 * Returns a DpsState ready to send.
 */
export function capabilityToDp(
  capabilityId: string,
  value: unknown,
  mapping: Record<string, CapabilityDpMapping>,
): DpsState {
  const config = mapping[capabilityId];
  if (!config) {
    throw new Error(`No mapping found for capability: ${capabilityId}`);
  }

  let dpValue: unknown = value;

  // Apply reverse value map
  if (config.reverseValueMap && typeof value === 'string') {
    dpValue = config.reverseValueMap[value] ?? value;
  }

  // Apply reverse transform
  dpValue = applyReverseTransform(dpValue, config.reverseTransform ?? config.transform);

  return { [config.dp]: dpValue as boolean | number | string };
}

/**
 * Build a mapping record from a profile, using custom overrides if present.
 */
export function buildMapping(
  profile: DeviceProfile,
  customMapping?: Record<string, string>,
): Record<string, CapabilityDpMapping> {
  const result: Record<string, CapabilityDpMapping> = {};

  for (const [capabilityId, config] of Object.entries(profile.mapping)) {
    if (customMapping && customMapping[capabilityId]) {
      result[capabilityId] = { ...config, dp: customMapping[capabilityId] };
    } else {
      result[capabilityId] = { ...config };
    }
  }

  return result;
}
