'use strict';

import TuyaDevice from '../../lib/TuyaDevice';

class TuyaSocketDevice extends TuyaDevice {

  protected _getDefaultProfile(): string {
    return 'socket_energy';
  }

}

module.exports = TuyaSocketDevice;
