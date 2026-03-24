'use strict';

import TuyaDevice from '../../lib/TuyaDevice';

class TuyaFanDevice extends TuyaDevice {

  protected _getDefaultProfile(): string {
    return 'fan_speed';
  }

}

module.exports = TuyaFanDevice;
