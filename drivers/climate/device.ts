'use strict';

import TuyaDevice from '../../lib/TuyaDevice';

class TuyaClimateDevice extends TuyaDevice {

  protected _getDefaultProfile(): string {
    return 'climate_thermostat';
  }

}

module.exports = TuyaClimateDevice;
