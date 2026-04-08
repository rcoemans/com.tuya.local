'use strict';

import Homey from 'homey';
import type { TuyaConnection } from './lib/tuya/connection';
import { AppLogger } from './lib/AppLogger';

class TuyaDirectApp extends Homey.App {

  /** Shared connection registry keyed by device ID */
  public connectionRegistry: Map<string, TuyaConnection> = new Map();

  /** App-level logger accessible via settings page */
  public appLogger!: AppLogger;

  async onInit(): Promise<void> {
    this.appLogger = new AppLogger(500);
    this.appLogger.info('App', 'Tuya Direct has been initialized');
    this.log('Tuya Direct has been initialized');
    this._registerFlowCards();
  }

  private _registerFlowCards(): void {
    // --- Triggers ---

    // dp_changed: triggered from TuyaDevice when a DP changes
    this.homey.flow.getDeviceTriggerCard('dp_changed')
      .registerRunListener(async (args, state) => {
        return args.dp === state.dp;
      });

    // device_connected / device_disconnected: no run listener needed (triggered from device)

    // --- Conditions ---

    this.homey.flow.getConditionCard('device_is_connected')
      .registerRunListener(async (args) => {
        const device = args.device as any;
        return device.connection?.connected === true;
      });

    this.homey.flow.getConditionCard('dp_value_is')
      .registerRunListener(async (args) => {
        const device = args.device as any;
        if (!device.connection?.connected) return false;
        const dps = await device.connection.status();
        if (!dps) return false;
        const dpValue = dps[args.dp];
        if (dpValue === undefined) return false;
        return String(dpValue) === String(args.value);
      });

    // --- Actions ---

    this.homey.flow.getActionCard('set_dp')
      .registerRunListener(async (args) => {
        const device = args.device as any;
        if (!device.connection) throw new Error('Device not connected');

        let value: boolean | number | string = args.value;
        if (args.value === 'true') value = true;
        else if (args.value === 'false') value = false;
        else if (!isNaN(Number(args.value)) && args.value.trim() !== '') value = Number(args.value);

        await device.connection.setDps({ [args.dp]: value });
      });

    this.homey.flow.getActionCard('refresh_status')
      .registerRunListener(async (args) => {
        const device = args.device as any;
        if (!device.connection) throw new Error('Device not connected');
        const dps = await device.connection.status();
        if (dps && typeof device._applyDps === 'function') {
          await device._applyDps(dps);
        }
      });
  }

}

module.exports = TuyaDirectApp;
