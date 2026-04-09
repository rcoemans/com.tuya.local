'use strict';

import TuyaDriver from '../../lib/TuyaDriver';
import type { DpsState } from '../../lib/tuya/types';

class TuyaDehumidifierDriver extends TuyaDriver {

  protected _getDefaultProfile(): string {
    return 'dehumidifier';
  }

  protected _buildDefaultMapping(dps: DpsState): Record<string, string> {
    const mapping: Record<string, string> = {};
    if ('1' in dps) mapping.onoff = '1';
    if ('2' in dps) mapping.dehumidifier_mode = '2';
    if ('4' in dps) mapping.target_humidity = '4';
    if ('6' in dps) mapping.dehumidifier_fan_speed = '6';
    if ('10' in dps) mapping.dehumidifier_anion = '10';
    if ('103' in dps) mapping.measure_temperature = '103';
    if ('104' in dps) mapping.measure_humidity = '104';
    return mapping;
  }

}

module.exports = TuyaDehumidifierDriver;
