'use strict';

import TuyaDriver from '../../lib/TuyaDriver';
import type { DpsState } from '../../lib/tuya/types';

class TuyaSocketDriver extends TuyaDriver {

  protected _getDefaultProfile(): string {
    return 'socket_energy';
  }

  protected _buildDefaultMapping(dps: DpsState): Record<string, string> {
    const mapping: Record<string, string> = {};
    if ('1' in dps) mapping.onoff = '1';
    if ('17' in dps) mapping.meter_power = '17';
    if ('18' in dps) mapping.measure_current = '18';
    if ('19' in dps) mapping.measure_power = '19';
    if ('20' in dps) mapping.measure_voltage = '20';
    return mapping;
  }

}

module.exports = TuyaSocketDriver;
