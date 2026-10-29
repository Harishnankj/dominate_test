import mqtt, { type MqttClient } from 'mqtt';
import crypto from 'crypto';
import { db } from '../db/index.js';
import { liveSync } from '../websocket/liveSync.js';

export interface Z2mExpose {
  type: string;
  name?: string;
  property?: string;
  access?: number;
  value_on?: any;
  value_off?: any;
  value_toggle?: any;
  features?: Z2mExpose[];
  unit?: string;
  values?: string[];
  description?: string;
}

export interface Z2mDeviceDefinition {
  model: string;
  vendor: string;
  description: string;
  exposes: Z2mExpose[];
}

export interface Z2mDiscoveredDevice {
  ieee_address: string;
  friendly_name: string;
  type: string; // 'EndDevice' | 'Router' | 'Coordinator'
  supported: boolean;
  definition?: Z2mDeviceDefinition | null;
  power_source?: string;
  linkquality?: number;
  disabled?: boolean;
  last_seen?: string;
}

export interface Z2mStatus {
  enabled: boolean;
  connected: boolean;
  brokerUrl: string;
  baseTopic: string;
  devicesCount: number;
  bridgeState: 'online' | 'offline' | 'unknown';
  lastError: string | null;
}

class MqttService {
  private client: MqttClient | null = null;
  private enabled: boolean = false;
  private connected: boolean = false;
  private brokerUrl: string = 'mqtt://127.0.0.1:1883';
  private username: string = '';
  private password: string = '';
  private baseTopic: string = 'zigbee2mqtt';
  private bridgeState: 'online' | 'offline' | 'unknown' = 'unknown';
  private lastError: string | null = null;

  // In-memory cache of discovered devices and live states
  private discoveredDevices: Map<string, Z2mDiscoveredDevice> = new Map();
  private deviceStates: Map<string, Record<string, any>> = new Map();

  public init() {
    try {
      const config = db.prepare('SELECT mqtt_enabled, mqtt_broker_url, mqtt_username, mqtt_password, mqtt_base_topic FROM building_config WHERE id = 1').get() as any;
      if (config) {
        this.enabled = config.mqtt_enabled === 1;
        this.brokerUrl = config.mqtt_broker_url || 'mqtt://127.0.0.1:1883';
        this.username = config.mqtt_username || '';
        this.password = config.mqtt_password || '';
        this.baseTopic = (config.mqtt_base_topic || 'zigbee2mqtt').trim();
      }

      if (this.enabled) {
        console.log(`[MQTT] Zigbee2MQTT enabled. Connecting to broker: ${this.brokerUrl}`);
        this.connect();
      } else {
        console.log('[MQTT] Zigbee2MQTT service initialized (Disabled in configuration)');
      }
    } catch (err: any) {
      console.warn('[MQTT] Error initializing MQTT service:', err.message);
    }
  }

  public connect(customConfig?: { brokerUrl?: string; username?: string; password?: string; baseTopic?: string }) {
    if (customConfig) {
      if (customConfig.brokerUrl) this.brokerUrl = customConfig.brokerUrl;
      if (customConfig.username !== undefined) this.username = customConfig.username;
      if (customConfig.password !== undefined) this.password = customConfig.password;
      if (customConfig.baseTopic) this.baseTopic = customConfig.baseTopic.trim();
    }

    this.disconnect();

    try {
      const options: mqtt.IClientOptions = {
        reconnectPeriod: 5000,
        connectTimeout: 10000,
        clientId: `dominatee_os_${crypto.randomBytes(3).toString('hex')}`,
        clean: true,
      };

      if (this.username) {
        options.username = this.username;
      }
      if (this.password) {
        options.password = this.password;
      }

      this.client = mqtt.connect(this.brokerUrl, options);

      this.client.on('connect', () => {
        this.connected = true;
        this.lastError = null;
        console.log(`[MQTT] Successfully connected to MQTT broker: ${this.brokerUrl}`);

        // Subscribe to Z2M topics
        const topics = [
          `${this.baseTopic}/#`,
          `${this.baseTopic}/bridge/state`,
          `${this.baseTopic}/bridge/devices`,
          `${this.baseTopic}/bridge/info`,
          `${this.baseTopic}/bridge/response/#`,
        ];

        this.client?.subscribe(topics, (err) => {
          if (err) {
            console.warn('[MQTT] Subscribe error:', err.message);
          } else {
            console.log(`[MQTT] Subscribed to Zigbee2MQTT base topic "${this.baseTopic}/#"`);
          }
        });

        this.broadcastStatus();
      });

      this.client.on('message', (topic: string, message: Buffer) => {
        this.handleIncomingMessage(topic, message.toString());
      });

      this.client.on('error', (err: Error) => {
        this.lastError = err.message;
        console.warn(`[MQTT] Broker connection error: ${err.message}`);
        this.broadcastStatus();
      });

      this.client.on('close', () => {
        if (this.connected) {
          console.log('[MQTT] Broker connection closed');
        }
        this.connected = false;
        this.broadcastStatus();
      });
    } catch (err: any) {
      this.lastError = err.message;
      this.connected = false;
      console.warn('[MQTT] Failed to initialize connection:', err.message);
      this.broadcastStatus();
    }
  }

  public disconnect() {
    if (this.client) {
      try {
        this.client.end(true);
      } catch (_) {}
      this.client = null;
    }
    this.connected = false;
    this.bridgeState = 'unknown';
  }

  private handleIncomingMessage(topic: string, payloadStr: string) {
    try {
      // 1. Bridge State
      if (topic === `${this.baseTopic}/bridge/state`) {
        let stateStr = payloadStr;
        try {
          const parsed = JSON.parse(payloadStr);
          if (parsed && typeof parsed.state === 'string') {
            stateStr = parsed.state;
          }
        } catch (_) {}

        this.bridgeState = stateStr.toLowerCase() === 'online' ? 'online' : 'offline';
        this.broadcastStatus();
        return;
      }

      // 2. Discovered Devices from Z2M Bridge
      if (topic === `${this.baseTopic}/bridge/devices`) {
        try {
          const list = JSON.parse(payloadStr);
          if (Array.isArray(list)) {
            this.discoveredDevices.clear();
            for (const item of list) {
              if (item.friendly_name) {
                this.discoveredDevices.set(item.friendly_name, {
                  ieee_address: item.ieee_address,
                  friendly_name: item.friendly_name,
                  type: item.type || 'EndDevice',
                  supported: item.supported ?? true,
                  definition: item.definition || null,
                  power_source: item.power_source,
                  linkquality: item.linkquality,
                  disabled: item.disabled,
                });
              }
            }
            console.log(`[MQTT] Discovered ${this.discoveredDevices.size} Zigbee2MQTT devices`);
            liveSync.broadcast('z2m_devices_updated', {
              count: this.discoveredDevices.size,
              devices: this.getDiscoveredDevices(),
            });
          }
        } catch (e: any) {
          console.warn('[MQTT] Failed to parse bridge/devices:', e.message);
        }
        return;
      }

      // 3. Regular device state updates
      if (topic.startsWith(`${this.baseTopic}/`)) {
        const sub = topic.slice(this.baseTopic.length + 1);

        // Ignore bridge system topics and command set topics
        if (sub.startsWith('bridge') || sub.endsWith('/set') || sub.endsWith('/get')) {
          return;
        }

        const friendlyName = sub.split('/')[0];
        if (!friendlyName) return;

        let parsedState: Record<string, any> = {};
        try {
          parsedState = JSON.parse(payloadStr);
        } catch (_) {
          parsedState = { state: payloadStr };
        }

        // Merge with existing state
        const current = this.deviceStates.get(friendlyName) || {};
        const merged = { ...current, ...parsedState };
        this.deviceStates.set(friendlyName, merged);

        // Broadcast to clients over WebSocket liveSync
        liveSync.broadcast('z2m_state_changed', {
          friendly_name: friendlyName,
          state: merged,
        });
      }
    } catch (err: any) {
      console.warn('[MQTT] Error processing incoming message:', err.message);
    }
  }

  // Publish direct device commands to Z2M
  public async setDeviceState(friendlyName: string, stateObj: Record<string, any>): Promise<boolean> {
    if (!this.client || !this.connected) {
      throw new Error('MQTT broker is not connected');
    }

    const topic = `${this.baseTopic}/${friendlyName}/set`;
    const payload = JSON.stringify(stateObj);

    return new Promise((resolve, reject) => {
      this.client?.publish(topic, payload, { qos: 0 }, (err) => {
        if (err) {
          console.warn(`[MQTT] Failed to publish to ${topic}:`, err.message);
          return reject(err);
        }

        // Optimistically update memory state
        const current = this.deviceStates.get(friendlyName) || {};
        const next = { ...current, ...stateObj };
        this.deviceStates.set(friendlyName, next);

        liveSync.broadcast('z2m_state_changed', {
          friendly_name: friendlyName,
          state: next,
        });

        resolve(true);
      });
    });
  }

  // Permit join (toggle Zigbee pairing mode)
  public async permitJoin(timeSeconds: number = 254): Promise<boolean> {
    if (!this.client || !this.connected) {
      throw new Error('MQTT broker is not connected');
    }

    const topic = `${this.baseTopic}/bridge/request/permit_join`;
    const payload = JSON.stringify({ value: timeSeconds > 0, time: timeSeconds });

    return new Promise((resolve, reject) => {
      this.client?.publish(topic, payload, (err) => {
        if (err) return reject(err);
        resolve(true);
      });
    });
  }

  // Get status
  public getStatus(): Z2mStatus {
    return {
      enabled: this.enabled,
      connected: this.connected,
      brokerUrl: this.brokerUrl,
      baseTopic: this.baseTopic,
      devicesCount: this.discoveredDevices.size,
      bridgeState: this.bridgeState,
      lastError: this.lastError,
    };
  }

  public getDiscoveredDevices(): Z2mDiscoveredDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  public getDeviceState(friendlyName: string): Record<string, any> | undefined {
    return this.deviceStates.get(friendlyName);
  }

  public getAllDeviceStates(): Record<string, any> {
    const obj: Record<string, any> = {};
    for (const [key, val] of this.deviceStates.entries()) {
      obj[key] = val;
    }
    return obj;
  }

  // Broadcast status to clients
  private broadcastStatus() {
    liveSync.broadcast('z2m_status_changed', this.getStatus());
  }

  // Update configuration and reconnect
  public updateConfigAndReconnect(config: {
    enabled: boolean;
    brokerUrl: string;
    username?: string;
    password?: string;
    baseTopic?: string;
  }) {
    this.enabled = config.enabled;
    this.brokerUrl = config.brokerUrl || 'mqtt://127.0.0.1:1883';
    this.username = config.username || '';
    if (config.password !== undefined) {
      this.password = config.password;
    }
    this.baseTopic = (config.baseTopic || 'zigbee2mqtt').trim();

    // Persist to DB
    const now = new Date().toISOString();
    db.prepare(`
      UPDATE building_config
      SET mqtt_enabled = ?,
          mqtt_broker_url = ?,
          mqtt_username = ?,
          mqtt_password = COALESCE(?, mqtt_password),
          mqtt_base_topic = ?,
          updated_at = ?
      WHERE id = 1
    `).run(
      this.enabled ? 1 : 0,
      this.brokerUrl,
      this.username,
      config.password !== undefined ? this.password : null,
      this.baseTopic,
      now
    );

    liveSync.broadcast('bootstrap_updated');

    if (this.enabled) {
      this.connect();
    } else {
      this.disconnect();
      this.broadcastStatus();
    }
  }

  // Auto-import discovered Zigbee devices into room
  public autoImportDevices(floorId?: string, roomId?: string) {
    const discovered = this.getDiscoveredDevices().filter((d) => d.type !== 'Coordinator');
    if (discovered.length === 0) {
      return { imported: 0, message: 'No non-coordinator Zigbee devices found to import' };
    }

    // Ensure floor exists
    let targetFloorId = floorId;
    if (!targetFloorId) {
      const firstFloor = db.prepare('SELECT id FROM floors LIMIT 1').get() as { id: string } | undefined;
      targetFloorId = firstFloor?.id;
    }

    if (!targetFloorId) {
      targetFloorId = `floor_${crypto.randomBytes(3).toString('hex')}`;
      db.prepare('INSERT INTO floors (id, name, slug) VALUES (?, ?, ?)').run(targetFloorId, 'Main Floor', 'main-floor');
    }

    // Ensure room exists
    let targetRoomId = roomId;
    if (!targetRoomId) {
      const firstRoom = db.prepare('SELECT id FROM rooms WHERE floor_id = ? LIMIT 1').get(targetFloorId) as { id: string } | undefined;
      targetRoomId = firstRoom?.id;
    }

    if (!targetRoomId) {
      targetRoomId = `room_${crypto.randomBytes(3).toString('hex')}`;
      db.prepare('INSERT INTO rooms (id, floor_id, name, slug) VALUES (?, ?, ?, ?)').run(
        targetRoomId,
        targetFloorId,
        'Zigbee Devices',
        'zigbee-devices'
      );
    }

    let importedCount = 0;
    const now = new Date().toISOString();

    for (const d of discovered) {
      // Check if already mapped
      const existing = db.prepare('SELECT id FROM devices WHERE z2m_friendly_name = ? OR name = ?').get(
        d.friendly_name,
        d.friendly_name
      );

      if (existing) continue;

      // Determine device type from exposes definition
      let devType = 'switch_light';
      const exposes = d.definition?.exposes || [];
      const hasLight = exposes.some((e: any) => e.type === 'light' || e.features?.some((f: any) => f.name === 'brightness'));
      const hasCover = exposes.some((e: any) => e.type === 'cover' || e.name === 'cover');
      const hasOccupancy = exposes.some((e: any) => e.name === 'occupancy' || e.property === 'occupancy');
      const hasClimate = exposes.some((e: any) => e.type === 'climate');

      if (hasLight) {
        devType = 'dimmable_light';
      } else if (hasCover) {
        devType = 'cover';
      } else if (hasOccupancy) {
        devType = 'presence_sensor';
      } else if (hasClimate) {
        devType = 'climate';
      }

      const devId = `dev_${crypto.randomBytes(4).toString('hex')}`;
      const devConfig = JSON.stringify({
        z2m_friendly_name: d.friendly_name,
        z2m_ieee: d.ieee_address,
        vendor: d.definition?.vendor || '',
        model: d.definition?.model || '',
      });

      db.prepare(`
        INSERT INTO devices (id, room_id, type, name, z2m_friendly_name, config_json, show_on_default_dashboard, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, 1, 0)
      `).run(devId, targetRoomId, devType, d.friendly_name, d.friendly_name, devConfig);

      importedCount++;
    }

    liveSync.broadcast('bootstrap_updated');
    return { imported: importedCount, totalDiscovered: discovered.length };
  }
}

export const mqttService = new MqttService();

