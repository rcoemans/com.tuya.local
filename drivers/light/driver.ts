'use strict';

import TuyaDriver from '../../lib/TuyaDriver';
import type { DpsState } from '../../lib/tuya/types';

class TuyaLightDriver extends TuyaDriver {

  protected _getDefaultProfile(): string {
    return 'light_color';
  }

  protected _buildDefaultMapping(dps: DpsState): Record<string, string> {
    const mapping: Record<string, string> = {};
    if ('20' in dps) mapping.onoff = '20';
    if ('21' in dps) mapping.light_mode = '21';
    if ('22' in dps) mapping.dim = '22';
    if ('23' in dps) mapping.light_temperature = '23';
    if ('24' in dps) mapping.light_hue = '24';
    if ('25' in dps) mapping.light_saturation = '25';
    return mapping;
  }

}

module.exports = TuyaLightDriver;
