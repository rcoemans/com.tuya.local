'use strict';

import TuyaDevice from '../../lib/TuyaDevice';

class TuyaLightDevice extends TuyaDevice {

  protected _getDefaultProfile(): string {
    return 'light_color';
  }

}

module.exports = TuyaLightDevice;
