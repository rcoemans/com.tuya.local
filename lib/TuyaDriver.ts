'use strict';

import Homey from 'homey';
import { TuyaConnection } from './tuya/connection';
import { inferProfile } from './tuya/profiles';
import type { ProtocolVersion, DpsState } from './tuya/types';

/**
 * Base Tuya driver class shared by all drivers.
 * Handles the custom pairing flow.
 */
class TuyaDriver extends Homey.Driver {

  async onInit(): Promise<void> {
    this.log(`${this.constructor.name} has been initialized`);
  }

  async onPairListDevices(): Promise<Record<string, unknown>[]> {
    // Manual pairing — return empty list, the user enters credentials in custom views
    return [];
  }

  async onPair(session: Homey.Driver.PairSession): Promise<void> {
    let deviceData: {
      host: string;
      deviceId: string;
      localKey: string;
      protocolVersion: ProtocolVersion;
      nodeId: string;
      name: string;
    } = {
      host: '',
      deviceId: '',
      localKey: '',
      protocolVersion: '3.3',
      nodeId: '',
      name: '',
    };

    let discoveredDps: DpsState = {};

    session.setHandler('get_device_data', async () => {
      return deviceData;
    });

    session.setHandler('set_device_data', async (data: typeof deviceData) => {
      deviceData = data;
    });

    session.setHandler('validate_connection', async () => {
      const connection = new TuyaConnection({
        host: deviceData.host,
        deviceId: deviceData.deviceId,
        localKey: deviceData.localKey,
        protocolVersion: deviceData.protocolVersion,
        nodeId: deviceData.nodeId || null,
        log: this.log.bind(this),
        error: this.error.bind(this),
      });

      try {
        await connection.connect();
        const dps = await connection.status();
        await connection.destroy();

        if (dps) {
          discoveredDps = dps;
          return { success: true, dps };
        }
        return { success: true, dps: {} };
      } catch (err) {
        try { await connection.destroy(); } catch { /* ignore */ }
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    });

    session.setHandler('get_discovered_dps', async () => {
      return discoveredDps;
    });

    session.setHandler('list_devices', async () => {
      const profile = inferProfile(discoveredDps);
      const deviceId = deviceData.nodeId
        ? `${deviceData.deviceId}:${deviceData.nodeId}`
        : deviceData.deviceId;

      return [{
        name: deviceData.name || `Tuya ${profile?.homeyClass || 'Device'}`,
        data: {
          id: deviceId,
        },
        settings: {
          host: deviceData.host,
          device_id: deviceData.deviceId,
          local_key: deviceData.localKey,
          protocol_version: deviceData.protocolVersion,
          node_id: deviceData.nodeId || '',
          poll_interval: 30,
        },
        store: {
          host: deviceData.host,
          device_id: deviceData.deviceId,
          protocol_version: deviceData.protocolVersion,
          node_id: deviceData.nodeId || null,
          profile: profile?.id || this._getDefaultProfile(),
          mapping: this._buildDefaultMapping(discoveredDps),
        },
      }];
    });
  }

  async onRepair(session: Homey.Driver.PairSession, device: Homey.Device): Promise<void> {
    session.setHandler('get_device_settings', async () => {
      return device.getSettings();
    });

    session.setHandler('update_credentials', async (data: { host: string; localKey: string; protocolVersion: ProtocolVersion }) => {
      await device.setSettings({
        host: data.host,
        local_key: data.localKey,
        protocol_version: data.protocolVersion,
      });
      return { success: true };
    });
  }

  /** Get the default profile ID for this driver type */
  protected _getDefaultProfile(): string {
    return 'socket_basic';
  }

  /** Build a simple DP mapping from discovered DPs */
  protected _buildDefaultMapping(_dps: DpsState): Record<string, string> {
    return {};
  }

}

export default TuyaDriver;
