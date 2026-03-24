'use strict';

import type { DeviceProfile, CapabilityDpMapping } from './types';

/** Built-in device profiles mapping Homey capabilities to Tuya DPs */
export const PROFILES: Record<string, DeviceProfile> = {

  socket_basic: {
    id: 'socket_basic',
    homeyClass: 'socket',
    capabilities: ['onoff'],
    requiredDps: ['1'],
    mapping: {
      onoff: { dp: '1' },
    },
  },

  socket_energy: {
    id: 'socket_energy',
    homeyClass: 'socket',
    capabilities: ['onoff', 'measure_power', 'meter_power', 'measure_current', 'measure_voltage'],
    requiredDps: ['1'],
    optionalDps: ['17', '18', '19', '20'],
    mapping: {
      onoff: { dp: '1' },
      meter_power: { dp: '17', transform: 'divideBy100' },
      measure_current: { dp: '18', transform: 'divideBy1000' },
      measure_power: { dp: '19', transform: 'divideBy10' },
      measure_voltage: { dp: '20', transform: 'divideBy10' },
    },
  },

  light_basic: {
    id: 'light_basic',
    homeyClass: 'light',
    capabilities: ['onoff'],
    requiredDps: ['20'],
    mapping: {
      onoff: { dp: '20' },
    },
  },

  light_dimmer: {
    id: 'light_dimmer',
    homeyClass: 'light',
    capabilities: ['onoff', 'dim'],
    requiredDps: ['20', '22'],
    mapping: {
      onoff: { dp: '20' },
      dim: { dp: '22', transform: 'divideBy1000' },
    },
  },

  light_color: {
    id: 'light_color',
    homeyClass: 'light',
    capabilities: ['onoff', 'dim', 'light_temperature', 'light_hue', 'light_saturation', 'light_mode'],
    requiredDps: ['20'],
    optionalDps: ['21', '22', '23', '24', '25'],
    mapping: {
      onoff: { dp: '20' },
      light_mode: { dp: '21', valueMap: { white: 'white', colour: 'color', scene: 'white', music: 'white' } },
      dim: { dp: '22', transform: 'divideBy1000' },
      light_temperature: { dp: '23', transform: 'divideBy1000' },
      light_hue: { dp: '24' },
      light_saturation: { dp: '25', transform: 'divideBy1000' },
    },
  },

  fan_basic: {
    id: 'fan_basic',
    homeyClass: 'fan',
    capabilities: ['onoff'],
    requiredDps: ['1'],
    mapping: {
      onoff: { dp: '1' },
    },
  },

  fan_speed: {
    id: 'fan_speed',
    homeyClass: 'fan',
    capabilities: ['onoff', 'dim'],
    requiredDps: ['1'],
    optionalDps: ['3'],
    mapping: {
      onoff: { dp: '1' },
      dim: { dp: '3', transform: 'divideBy100' },
    },
  },

  air_purifier: {
    id: 'air_purifier',
    homeyClass: 'fan',
    capabilities: [
      'onoff',
      'measure_pm25',
      'air_purifier_mode',
      'air_purifier_speed',
      'air_purifier_filter_life',
      'air_purifier_ionizer',
      'air_purifier_child_lock',
      'air_purifier_air_quality',
    ],
    requiredDps: ['1'],
    optionalDps: ['2', '3', '4', '5', '6', '7', '21'],
    mapping: {
      onoff: { dp: '1' },
      measure_pm25: { dp: '2' },
      air_purifier_mode: { dp: '3' },
      air_purifier_speed: { dp: '4' },
      air_purifier_filter_life: { dp: '5' },
      air_purifier_ionizer: { dp: '6' },
      air_purifier_child_lock: { dp: '7' },
      air_purifier_air_quality: { dp: '21' },
    },
  },

  humidifier: {
    id: 'humidifier',
    homeyClass: 'fan',
    capabilities: [
      'onoff',
      'humidifier_mode',
      'dim',
      'target_humidity',
      'measure_humidity',
      'measure_temperature',
    ],
    requiredDps: ['1'],
    optionalDps: ['2', '3', '4', '6', '7'],
    mapping: {
      onoff: { dp: '1' },
      humidifier_mode: { dp: '2' },
      dim: { dp: '3', transform: 'divideBy100' },
      target_humidity: { dp: '4' },
      measure_humidity: { dp: '6' },
      measure_temperature: { dp: '7' },
    },
  },

  dehumidifier: {
    id: 'dehumidifier',
    homeyClass: 'fan',
    capabilities: [
      'onoff',
      'dehumidifier_mode',
      'dehumidifier_fan_speed',
      'target_humidity',
      'measure_humidity',
      'measure_temperature',
      'dehumidifier_anion',
    ],
    requiredDps: ['1'],
    optionalDps: ['2', '4', '5', '6', '7', '10'],
    mapping: {
      onoff: { dp: '1' },
      target_humidity: { dp: '2' },
      dehumidifier_fan_speed: { dp: '4' },
      dehumidifier_mode: { dp: '5' },
      measure_humidity: { dp: '6' },
      measure_temperature: { dp: '7' },
      dehumidifier_anion: { dp: '10' },
    },
  },

  climate_thermostat: {
    id: 'climate_thermostat',
    homeyClass: 'thermostat',
    capabilities: ['onoff', 'target_temperature', 'measure_temperature'],
    requiredDps: ['1'],
    optionalDps: ['2', '3', '4'],
    mapping: {
      onoff: { dp: '1' },
      target_temperature: { dp: '2', transform: 'divideBy10' },
      measure_temperature: { dp: '3', transform: 'divideBy10' },
    },
  },

};

/** Get a profile by its ID */
export function getProfile(profileId: string): DeviceProfile | undefined {
  return PROFILES[profileId];
}

/** Get all profiles matching a Homey class */
export function getProfilesByClass(homeyClass: string): DeviceProfile[] {
  return Object.values(PROFILES).filter((p) => p.homeyClass === homeyClass);
}

/** Try to infer a profile from discovered DPs */
export function inferProfile(dps: Record<string, unknown>): DeviceProfile | null {
  const dpKeys = Object.keys(dps);
  let bestMatch: DeviceProfile | null = null;
  let bestScore = 0;

  for (const profile of Object.values(PROFILES)) {
    const hasRequired = profile.requiredDps.every((dp) => dpKeys.includes(dp));
    if (!hasRequired) continue;

    let score = profile.requiredDps.length;
    if (profile.optionalDps) {
      score += profile.optionalDps.filter((dp) => dpKeys.includes(dp)).length;
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = profile;
    }
  }

  return bestMatch;
}
