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
    if ('2' in dps) mapping.target_humidity = '2';
    if ('4' in dps) mapping.dehumidifier_fan_speed = '4';
    if ('5' in dps) mapping.dehumidifier_mode = '5';
    if ('6' in dps) mapping.measure_humidity = '6';
    if ('7' in dps) mapping.measure_temperature = '7';
    if ('10' in dps) mapping.dehumidifier_anion = '10';
    return mapping;
  }

}

module.exports = TuyaDehumidifierDriver;
