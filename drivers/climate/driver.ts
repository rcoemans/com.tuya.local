'use strict';

import TuyaDriver from '../../lib/TuyaDriver';
import type { DpsState } from '../../lib/tuya/types';

class TuyaClimateDriver extends TuyaDriver {

  protected _getDefaultProfile(): string {
    return 'climate_thermostat';
  }

  protected _buildDefaultMapping(dps: DpsState): Record<string, string> {
    const mapping: Record<string, string> = {};
    if ('1' in dps) mapping.onoff = '1';
    if ('2' in dps) mapping.target_temperature = '2';
    if ('3' in dps) mapping.measure_temperature = '3';
    return mapping;
  }

}

module.exports = TuyaClimateDriver;
