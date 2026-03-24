'use strict';

import TuyaDevice from '../../lib/TuyaDevice';

class TuyaDehumidifierDevice extends TuyaDevice {

  protected _getDefaultProfile(): string {
    return 'dehumidifier';
  }

}

module.exports = TuyaDehumidifierDevice;
