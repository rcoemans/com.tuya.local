'use strict';

import TuyaDevice from '../../lib/TuyaDevice';

class TuyaHumidifierDevice extends TuyaDevice {

  protected _getDefaultProfile(): string {
    return 'humidifier';
  }

}

module.exports = TuyaHumidifierDevice;
