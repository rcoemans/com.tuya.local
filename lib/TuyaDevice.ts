'use strict';

import Homey from 'homey';
import { TuyaConnection } from './tuya/connection';
import { dpToCapability, capabilityToDp, buildMapping } from './tuya/mapper';
import { getProfile } from './tuya/profiles';
import type { DpsState, CapabilityDpMapping, ProtocolVersion } from './tuya/types';

/**
 * Base Tuya device class shared by all drivers.
 * Handles connection lifecycle, DP mapping, and capability sync.
 */
class TuyaDevice extends Homey.Device {

  protected connection!: TuyaConnection;
  protected mapping: Record<string, CapabilityDpMapping> = {};
  private _lastDps: DpsState = {};

  async onInit(): Promise<void> {
    const settings = this.getSettings();
    const store = this.getStore();

    // Build mapping from profile + custom overrides
    const profileId = store.profile || this._getDefaultProfile();
    const profile = getProfile(profileId);
    if (profile) {
      this.mapping = buildMapping(profile, store.mapping || undefined);
    }

    // Create connection
    this.connection = new TuyaConnection({
      host: settings.host,
      deviceId: settings.device_id,
      localKey: settings.local_key,
      protocolVersion: settings.protocol_version as ProtocolVersion,
      nodeId: settings.node_id || null,
      pollInterval: settings.poll_interval,
      log: this.log.bind(this),
      error: this.error.bind(this),
    });

    // Register capability listeners
    this._registerCapabilityListeners();

    // Connection events
    this.connection.on('connected', async () => {
      await this.setAvailable();
      this.homey.flow.getDeviceTriggerCard('device_connected')
        .trigger(this).catch((err: Error) => this.error('Trigger device_connected failed:', err));
    });

    this.connection.on('disconnected', async (err?: Error) => {
      await this.setUnavailable(err?.message || this.homey.__('errors.disconnected'));
      this.homey.flow.getDeviceTriggerCard('device_disconnected')
        .trigger(this).catch((e: Error) => this.error('Trigger device_disconnected failed:', e));
    });

    this.connection.on('dps', async (dps: DpsState) => {
      await this._applyDps(dps);
      this._emitDpChangeTriggers(dps);
    });

    this.connection.on('error', (err: Error) => {
      this.error('Connection error:', err.message);
    });

    // Start connection
    await this.connection.connect();
  }

  /** Emit dp_changed flow triggers for changed DPs */
  private _emitDpChangeTriggers(dps: DpsState): void {
    for (const [dp, value] of Object.entries(dps)) {
      if (this._lastDps[dp] !== value) {
        this._lastDps[dp] = value;
        const tokens = { value: String(value), dp };
        const state = { dp };
        this.homey.flow.getDeviceTriggerCard('dp_changed')
          .trigger(this, tokens, state)
          .catch((err: Error) => this.error(`Trigger dp_changed failed for DP ${dp}:`, err));
      }
    }
  }

  /** Apply incoming DP values to Homey capabilities */
  protected async _applyDps(dps: DpsState): Promise<void> {
    const updates = dpToCapability(dps, this.mapping);

    for (const [capabilityId, value] of Object.entries(updates)) {
      if (this.hasCapability(capabilityId)) {
        try {
          await this.setCapabilityValue(capabilityId, value as string | number | boolean | null);
        } catch (err) {
          this.error(`Failed to set ${capabilityId}:`, err);
        }
      }
    }
  }

  /** Register listeners for all mapped capabilities */
  protected _registerCapabilityListeners(): void {
    for (const capabilityId of Object.keys(this.mapping)) {
      if (!this.hasCapability(capabilityId)) continue;

      this.registerCapabilityListener(capabilityId, async (value: unknown) => {
        try {
          const dpCommand = capabilityToDp(capabilityId, value, this.mapping);
          await this.connection.setDps(dpCommand);
        } catch (err) {
          this.error(`Failed to set ${capabilityId}:`, err);
          throw err;
        }
      });
    }
  }

  /** Get the default profile ID for this driver */
  protected _getDefaultProfile(): string {
    return 'socket_basic';
  }

  async onSettings({ changedKeys, newSettings }: {
    oldSettings: Record<string, unknown>;
    newSettings: Record<string, unknown>;
    changedKeys: string[];
  }): Promise<string | void> {
    const reconnectKeys = ['host', 'local_key', 'protocol_version', 'poll_interval', 'node_id'];
    if (changedKeys.some((key) => reconnectKeys.includes(key))) {
      await this.connection.reconnect({
        host: newSettings.host as string,
        localKey: newSettings.local_key as string,
        protocolVersion: newSettings.protocol_version as ProtocolVersion,
        pollInterval: newSettings.poll_interval as number,
        nodeId: (newSettings.node_id as string) || null,
      });
    }
  }

  async onDeleted(): Promise<void> {
    if (this.connection) {
      await this.connection.destroy();
    }
  }

}

export default TuyaDevice;
