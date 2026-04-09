'use strict';

import TuyaDriver from '../../lib/TuyaDriver';
import type { DpsState } from '../../lib/tuya/types';

class TuyaHumidifierDriver extends TuyaDriver {

  protected _getDefaultProfile(): string {
    return 'humidifier';
  }

  protected _buildDefaultMapping(dps: DpsState): Record<string, string> {
    const mapping: Record<string, string> = {};
    if ('1' in dps) mapping.onoff = '1';
    if ('2' in dps) mapping.humidifier_mode = '2';
    if ('3' in dps) mapping.dim = '3';
    if ('4' in dps) mapping.humidifier_target_humidity = '4';
    if ('6' in dps) mapping.measure_humidity = '6';
    if ('7' in dps) mapping.measure_temperature = '7';
    return mapping;
  }

}

module.exports = TuyaHumidifierDriver;
