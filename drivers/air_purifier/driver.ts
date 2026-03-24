'use strict';

import TuyaDriver from '../../lib/TuyaDriver';
import type { DpsState } from '../../lib/tuya/types';

class TuyaAirPurifierDriver extends TuyaDriver {

  protected _getDefaultProfile(): string {
    return 'air_purifier';
  }

  protected _buildDefaultMapping(dps: DpsState): Record<string, string> {
    const mapping: Record<string, string> = {};
    if ('1' in dps) mapping.onoff = '1';
    if ('2' in dps) mapping.measure_pm25 = '2';
    if ('3' in dps) mapping.air_purifier_mode = '3';
    if ('4' in dps) mapping.air_purifier_speed = '4';
    if ('5' in dps) mapping.air_purifier_filter_life = '5';
    if ('6' in dps) mapping.air_purifier_ionizer = '6';
    if ('7' in dps) mapping.air_purifier_child_lock = '7';
    if ('21' in dps) mapping.air_purifier_air_quality = '21';
    return mapping;
  }

}

module.exports = TuyaAirPurifierDriver;
