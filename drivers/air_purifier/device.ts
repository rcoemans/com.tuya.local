'use strict';

import TuyaDevice from '../../lib/TuyaDevice';

class TuyaAirPurifierDevice extends TuyaDevice {

  protected _getDefaultProfile(): string {
    return 'air_purifier';
  }

}

module.exports = TuyaAirPurifierDevice;
