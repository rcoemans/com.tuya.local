'use strict';

import TuyaDriver from '../../lib/TuyaDriver';
import type { DpsState } from '../../lib/tuya/types';

class TuyaFanDriver extends TuyaDriver {

  protected _getDefaultProfile(): string {
    return 'fan_speed';
  }

  protected _buildDefaultMapping(dps: DpsState): Record<string, string> {
    const mapping: Record<string, string> = {};
    if ('1' in dps) mapping.onoff = '1';
    if ('3' in dps) mapping.dim = '3';
    return mapping;
  }

}

module.exports = TuyaFanDriver;
