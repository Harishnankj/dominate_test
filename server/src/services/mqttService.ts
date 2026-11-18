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
  base_topic?: string;
  hub_id?: string;
  hub_name?: string;
}

export interface Z2mHubRecord {
  id: string;
  name: string;
  broker_url: string;
  base_topic: string;
  username?: string;
  password?: string;
  enabled: number;
  sort_order: number;
}

export interface Z2mHubStatus {
  id: string;
  name: string;
  broker_url: string;
  base_topic: string;
  enabled: boolean;
  connected: boolean;
  bridgeState: 'online' | 'offline' | 'unknown';
  devicesCount: number;
  lastError: string | null;
}

export interface Z2mStatus {
  enabled: boolean;
  connected: boolean;
  brokerUrl: string;
  baseTopic: string;
  devicesCount: number;
  bridgeState: 'online' | 'offline' | 'unknown';
  lastError: string | null;
  hubs: Z2mHubStatus[];
}

export function normalizeBrokerUrl(rawUrl: string): string {
  let url = (rawUrl || 'mqtt://127.0.0.1:1883').trim();
  if (url.startsWith('http://') || url.startsWith('https://')) {
    url = url.replace(/^https?:\/\//i, 'mqtt://');
  }
  if (!url.startsWith('mqtt://') && !url.startsWith('mqtts://') && !url.startsWith('ws://') && !url.startsWith('wss://')) {
    url = `mqtt://${url}`;
  }
  // Replace HTTP web UI ports (like 8085 or 8080) with 1883
  url = url.replace(/:808[0-9](\/?)$/, ':1883$1');
  const withoutProto = url.replace(/^[a-z]+:\/\//, '');
  if (!withoutProto.includes(':')) {
    url = `${url.replace(/\/$/, '')}:1883`;
  }
  return url;
}

interface HubConnection {
  hub: Z2mHubRecord;
  client: MqttClient | null;
  connected: boolean;
  bridgeState: 'online' | 'offline' | 'unknown';
  lastError: string | null;
}

class MqttService {
  private hubConnections: Map<string, HubConnection> = new Map();

  // In-memory cache of discovered devices and live states
  private discoveredDevices: Map<string, Z2mDiscoveredDevice> = new Map();
  private deviceStates: Map<string, Record<string, any>> = new Map();

  public init() {
    try {
      // Load all hubs from z2m_hubs table
      const hubs = (db.prepare('SELECT * FROM z2m_hubs ORDER BY sort_order ASC, name ASC').all() as unknown) as Z2mHubRecord[];
      console.log(`[MQTT] Initializing Multi-Hub Zigbee2MQTT service (${hubs.length} coordinators configured)`);

      for (const hub of hubs) {
        if (hub.enabled === 1) {
          this.connectHub(hub);
        } else {
          this.hubConnections.set(hub.id, {
            hub,
            client: null,
            connected: false,
            bridgeState: 'unknown',
            lastError: null,
          });
        }
      }
    } catch (err: any) {
      console.warn('[MQTT] Error initializing MQTT service:', err.message);
    }
  }

  // Connect a specific coordinator hub
  public connectHub(hub: Z2mHubRecord) {
    this.disconnectHub(hub.id);

    const brokerUrl = normalizeBrokerUrl(hub.broker_url);
    const baseTopic = (hub.base_topic || 'zigbee2mqtt').trim();

    const conn: HubConnection = {
      hub,
      client: null,
      connected: false,
      bridgeState: 'unknown',
      lastError: null,
    };
    this.hubConnections.set(hub.id, conn);

    try {
      const options: mqtt.IClientOptions = {
        protocolVersion: 4,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
        clientId: `dominatee_${hub.id}_${crypto.randomBytes(2).toString('hex')}`,
        clean: true,
      };

      if (hub.username) options.username = hub.username;
      if (hub.password) options.password = hub.password;

      console.log(`[MQTT] [${hub.name}] Connecting to ${brokerUrl} (base topic: ${baseTopic})`);
      const client = mqtt.connect(brokerUrl, options);
      conn.client = client;

      client.on('connect', () => {
        conn.connected = true;
        conn.lastError = null;
        console.log(`[MQTT] [${hub.name}] Connected to broker: ${brokerUrl}`);

        const topics = [
          `${baseTopic}/#`,
          `${baseTopic}/bridge/state`,
          `${baseTopic}/bridge/devices`,
          `${baseTopic}/bridge/info`,
          `${baseTopic}/bridge/response/#`,
        ];

        client.subscribe(topics, (err) => {
          if (err) {
            console.warn(`[MQTT] [${hub.name}] Subscribe error:`, err.message);
          } else {
            console.log(`[MQTT] [${hub.name}] Subscribed to "${baseTopic}/#"`);
          }
        });

        this.broadcastStatus();
      });

      client.on('message', (topic: string, message: Buffer) => {
        this.handleIncomingMessage(hub, conn, topic, message.toString());
      });

      client.on('error', (err: Error) => {
        conn.lastError = err.message;
        console.warn(`[MQTT] [${hub.name}] Error: ${err.message}`);
        this.broadcastStatus();
      });

      client.on('close', () => {
        if (conn.connected) {
          console.log(`[MQTT] [${hub.name}] Connection closed`);
        }
        conn.connected = false;
        this.broadcastStatus();
      });
    } catch (err: any) {
      conn.lastError = err.message;
      conn.connected = false;
      console.warn(`[MQTT] [${hub.name}] Failed to initialize connection:`, err.message);
      this.broadcastStatus();
    }
  }

  // Disconnect a specific coordinator hub
  public disconnectHub(hubId: string) {
    const conn = this.hubConnections.get(hubId);
    if (conn && conn.client) {
      try {
        conn.client.end(true);
      } catch (_) {}
      conn.client = null;
    }
    if (conn) {
      conn.connected = false;
      conn.bridgeState = 'unknown';
    }
  }

  public disconnectAll() {
    for (const hubId of this.hubConnections.keys()) {
      this.disconnectHub(hubId);
    }
  }

  // Handle incoming messages from a specific hub
  private handleIncomingMessage(hub: Z2mHubRecord, conn: HubConnection, topic: string, payloadStr: string) {
    try {
      const baseTopic = (hub.base_topic || 'zigbee2mqtt').trim();

      // 1. Bridge State
      if (topic === `${baseTopic}/bridge/state`) {
        let stateStr = payloadStr;
        try {
          const parsed = JSON.parse(payloadStr);
          if (parsed && typeof parsed.state === 'string') {
            stateStr = parsed.state;
          }
        } catch (_) {}

        conn.bridgeState = stateStr.toLowerCase() === 'online' ? 'online' : 'offline';
        this.broadcastStatus();
        return;
      }

      // 2. Discovered Devices
      if (topic === `${baseTopic}/bridge/devices`) {
        try {
          const list = JSON.parse(payloadStr);
          if (Array.isArray(list)) {
            // Remove old devices associated with this specific hub
            for (const [key, dev] of this.discoveredDevices.entries()) {
              if (dev.hub_id === hub.id) {
                this.discoveredDevices.delete(key);
              }
            }

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
                  base_topic: baseTopic,
                  hub_id: hub.id,
                  hub_name: hub.name,
                });
              }
            }

            console.log(`[MQTT] [${hub.name}] Discovered ${list.length} devices (Total across all coordinators: ${this.discoveredDevices.size})`);
            liveSync.broadcast('z2m_devices_updated', {
              count: this.discoveredDevices.size,
              devices: this.getDiscoveredDevices(),
            });
          }
        } catch (e: any) {
          console.warn(`[MQTT] [${hub.name}] Failed to parse bridge/devices:`, e.message);
        }
        return;
      }

      // 3. Regular device state updates
      if (topic.startsWith(`${baseTopic}/`)) {
        const sub = topic.slice(baseTopic.length + 1);

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

        // Bi-directional lookup: also index under ieee_address (or friendly_name) so both keys work
        const knownDev = Array.from(this.discoveredDevices.values()).find(
          (d) => d.friendly_name === friendlyName || d.ieee_address === friendlyName
        );

        // If multi-gang, dynamically compute collective state for the master tile
        const exposes = knownDev?.definition?.exposes || [];
        const switchExposes = exposes.filter(
          (e: any) =>
            e.type === 'switch' ||
            e.name === 'state' ||
            e.features?.some((f: any) => f.name === 'state')
        );
        if (switchExposes.length > 1) {
          const endpointProps = switchExposes.map(
            (e: any) => e.features?.[0]?.property || e.property || (e.endpoint ? `state_${e.endpoint}` : 'state')
          );
          const anyOn = endpointProps.some((p: string) => String(merged[p] || '').toUpperCase() === 'ON');
          merged.state = anyOn ? 'ON' : 'OFF';
        }

        this.deviceStates.set(friendlyName, merged);

        if (knownDev) {
          if (knownDev.ieee_address && knownDev.ieee_address !== friendlyName) {
            this.deviceStates.set(knownDev.ieee_address, merged);
          }
          if (knownDev.friendly_name && knownDev.friendly_name !== friendlyName) {
            this.deviceStates.set(knownDev.friendly_name, merged);
          }
        }

        // Broadcast to clients over WebSocket liveSync
        liveSync.broadcast('z2m_state_changed', {
          friendly_name: friendlyName,
          state: merged,
        });
      }
    } catch (err: any) {
      console.warn(`[MQTT] [${hub.name}] Error processing message:`, err.message);
    }
  }

  // Publish direct device commands to Z2M
  public async setDeviceState(friendlyName: string, stateObj: Record<string, any>): Promise<boolean> {
    const knownDev = Array.from(this.discoveredDevices.values()).find(
      (d) => d.friendly_name === friendlyName || d.ieee_address === friendlyName
    );

    // Identify which hub connection owns this device
    let targetConn: HubConnection | undefined;
    if (knownDev?.hub_id) {
      targetConn = this.hubConnections.get(knownDev.hub_id);
    }

    // Fallback: use first connected hub
    if (!targetConn || !targetConn.connected || !targetConn.client) {
      targetConn = Array.from(this.hubConnections.values()).find((c) => c.connected && c.client);
    }

    if (!targetConn || !targetConn.client) {
      throw new Error('No connected Zigbee2MQTT coordinator available');
    }

    const baseTopic = (knownDev?.base_topic || targetConn.hub.base_topic || 'zigbee2mqtt').trim();
    const target = knownDev?.friendly_name || friendlyName;
    const topic = `${baseTopic}/${target}/set`;

    // Smart Toggle & Multi-gang Converter:
    // Tuya devices (meters, breakers, switches) fail with: Error: Key 'TOGGLE' not found in: [ON, OFF]
    // Here we resolve the current state and translate TOGGLE to the exact ON/OFF payload the device expects.
    const current =
      this.deviceStates.get(target) ||
      (knownDev?.ieee_address ? this.deviceStates.get(knownDev.ieee_address) : {}) ||
      {};

    const exposes = knownDev?.definition?.exposes || [];
    const switchExposes = exposes.filter(
      (e: any) =>
        e.type === 'switch' ||
        e.name === 'state' ||
        e.features?.some((f: any) => f.name === 'state')
    );

    let resolvedPayload: Record<string, any> = { ...stateObj };

    // 1. Support specific endpoint targeting (e.g. { endpoint: 'l1', state: 'ON' } or { endpoint: '1', state: 'TOGGLE' })
    if (resolvedPayload.endpoint && resolvedPayload.state) {
      const epStr = String(resolvedPayload.endpoint).trim();
      const prop = epStr.startsWith('state_') ? epStr : epStr.startsWith('l') ? `state_${epStr}` : `state_l${epStr}`;
      const cmd = String(resolvedPayload.state).toUpperCase();
      delete resolvedPayload.endpoint;
      delete resolvedPayload.state;
      if (cmd === 'TOGGLE') {
        const isCurrentOn = String(current[prop] || '').toUpperCase() === 'ON';
        resolvedPayload[prop] = isCurrentOn ? 'OFF' : 'ON';
      } else {
        resolvedPayload[prop] = cmd;
      }
    }

    // 2. Handle generic 'state' commands ('ON', 'OFF', or 'TOGGLE')
    if (resolvedPayload.state && typeof resolvedPayload.state === 'string') {
      const cmd = resolvedPayload.state.toUpperCase();
      if (switchExposes.length > 1) {
        // Multi-gang switch panel (e.g. 4-gang panel with state_l1, state_l2, etc.)
        const endpointProps = switchExposes.map(
          (e: any) => e.features?.[0]?.property || e.property || (e.endpoint ? `state_${e.endpoint}` : 'state')
        );
        delete resolvedPayload.state;
        if (cmd === 'TOGGLE') {
          const anyOn = endpointProps.some((p: string) => String(current[p] || '').toUpperCase() === 'ON');
          const nextVal = anyOn ? 'OFF' : 'ON';
          for (const p of endpointProps) {
            resolvedPayload[p] = nextVal;
          }
        } else {
          // Both ON and OFF commands are distributed to all gangs
          for (const p of endpointProps) {
            resolvedPayload[p] = cmd;
          }
        }
      } else {
        // Single relay, breaker, or energy meter
        if (cmd === 'TOGGLE') {
          const isCurrentOn = String(current.state || '').toUpperCase() === 'ON';
          resolvedPayload.state = isCurrentOn ? 'OFF' : 'ON';
        } else {
          resolvedPayload.state = cmd;
        }
      }
    }

    // 3. Resolve any individual endpoint properties passed as 'TOGGLE' (e.g. { state_l1: 'TOGGLE' })
    for (const [k, v] of Object.entries(resolvedPayload)) {
      if (typeof v === 'string' && v.toUpperCase() === 'TOGGLE') {
        const isCurrentOn = String(current[k] || '').toUpperCase() === 'ON';
        resolvedPayload[k] = isCurrentOn ? 'OFF' : 'ON';
      }
    }

    const payload = JSON.stringify(resolvedPayload);
    console.log(`[MQTT] [${targetConn.hub.name}] Publishing to ${topic}: ${payload}`);

    return new Promise((resolve, reject) => {
      targetConn!.client?.publish(topic, payload, { qos: 0 }, (err) => {
        if (err) {
          console.warn(`[MQTT] Failed to publish to ${topic}:`, err.message);
          return reject(err);
        }

        // Optimistically update memory state
        const next = { ...current, ...resolvedPayload };
        if (switchExposes.length > 1) {
          const endpointProps = switchExposes.map(
            (e: any) => e.features?.[0]?.property || e.property || (e.endpoint ? `state_${e.endpoint}` : 'state')
          );
          const anyOn = endpointProps.some((p: string) => String(next[p] || '').toUpperCase() === 'ON');
          next.state = anyOn ? 'ON' : 'OFF';
        }
        this.deviceStates.set(target, next);
        if (knownDev?.ieee_address) {
          this.deviceStates.set(knownDev.ieee_address, next);
        }

        liveSync.broadcast('z2m_state_changed', {
          friendly_name: target,
          state: next,
        });

        resolve(true);
      });
    });
  }

  // Permit join (toggle Zigbee pairing mode) on all coordinators or a specific one
  public async permitJoin(timeSeconds: number = 254, hubId?: string): Promise<boolean> {
    const payload = JSON.stringify({ value: timeSeconds > 0, time: timeSeconds });
    const conns = hubId
      ? [this.hubConnections.get(hubId)].filter(Boolean) as HubConnection[]
      : Array.from(this.hubConnections.values()).filter((c) => c.connected && c.client);

    if (conns.length === 0) {
      throw new Error('No connected Zigbee coordinators available to permit join');
    }

    return new Promise((resolve, reject) => {
      let pending = conns.length;
      let lastErr: any = null;

      for (const conn of conns) {
        const topic = `${conn.hub.base_topic || 'zigbee2mqtt'}/bridge/request/permit_join`;
        conn.client?.publish(topic, payload, (err) => {
          if (err) lastErr = err;
          pending--;
          if (pending <= 0) {
            if (lastErr && conns.length === 1) return reject(lastErr);
            resolve(true);
          }
        });
      }
    });
  }

  // Get overall status and individual hub statuses
  public getStatus(): Z2mStatus {
    const hubStatuses: Z2mHubStatus[] = Array.from(this.hubConnections.values()).map((c) => {
      const devCount = Array.from(this.discoveredDevices.values()).filter((d) => d.hub_id === c.hub.id).length;
      return {
        id: c.hub.id,
        name: c.hub.name,
        broker_url: c.hub.broker_url,
        base_topic: c.hub.base_topic,
        enabled: c.hub.enabled === 1,
        connected: c.connected,
        bridgeState: c.bridgeState,
        devicesCount: devCount,
        lastError: c.lastError,
      };
    });

    const anyConnected = hubStatuses.some((h) => h.connected);
    const anyBridgeOnline = hubStatuses.some((h) => h.bridgeState === 'online');
    const firstHub = hubStatuses[0];

    return {
      enabled: hubStatuses.some((h) => h.enabled),
      connected: anyConnected,
      brokerUrl: firstHub?.broker_url || 'mqtt://127.0.0.1:1883',
      baseTopic: hubStatuses.map((h) => h.base_topic).join(', '),
      devicesCount: this.discoveredDevices.size,
      bridgeState: anyBridgeOnline ? 'online' : anyConnected ? 'offline' : 'unknown',
      lastError: hubStatuses.find((h) => h.lastError)?.lastError || null,
      hubs: hubStatuses,
    };
  }

  public getDiscoveredDevices(): Z2mDiscoveredDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  public getDeviceState(friendlyName: string): Record<string, any> | undefined {
    return this.deviceStates.get(friendlyName);
  }

  public getAllDeviceStates(): Record<string, Record<string, any>> {
    const obj: Record<string, Record<string, any>> = {};
    for (const [k, v] of this.deviceStates.entries()) {
      obj[k] = v;
    }
    return obj;
  }

  // Hub CRUD management
  public getHubs(): Z2mHubStatus[] {
    return this.getStatus().hubs;
  }

  public addHub(data: {
    name: string;
    broker_url: string;
    base_topic?: string;
    username?: string;
    password?: string;
    enabled?: boolean;
  }): Z2mHubRecord {
    const id = `z2m_hub_${crypto.randomBytes(4).toString('hex')}`;
    const name = (data.name || 'New Coordinator').trim();
    const broker_url = normalizeBrokerUrl(data.broker_url);
    const base_topic = (data.base_topic || 'zigbee2mqtt').trim();
    const username = (data.username || '').trim();
    const password = data.password || '';
    const enabled = data.enabled !== false ? 1 : 0;

    const countRow = db.prepare('SELECT COUNT(*) as cnt FROM z2m_hubs').get() as { cnt: number };
    const sort_order = countRow?.cnt || 0;

    db.prepare(`
      INSERT INTO z2m_hubs (id, name, broker_url, base_topic, username, password, enabled, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, broker_url, base_topic, username, password, enabled, sort_order);

    const record: Z2mHubRecord = { id, name, broker_url, base_topic, username, password, enabled, sort_order };

    if (enabled === 1) {
      this.connectHub(record);
    } else {
      this.hubConnections.set(id, {
        hub: record,
        client: null,
        connected: false,
        bridgeState: 'unknown',
        lastError: null,
      });
    }

    this.broadcastStatus();
    liveSync.broadcast('bootstrap_updated');
    return record;
  }

  public updateHub(
    id: string,
    data: {
      name?: string;
      broker_url?: string;
      base_topic?: string;
      username?: string;
      password?: string;
      enabled?: boolean;
    }
  ): Z2mHubRecord {
    const existing = (db.prepare('SELECT * FROM z2m_hubs WHERE id = ?').get(id) as unknown) as Z2mHubRecord | undefined;
    if (!existing) {
      throw new Error(`Coordinator hub ${id} not found`);
    }

    const name = data.name !== undefined ? data.name.trim() : existing.name;
    const broker_url = data.broker_url !== undefined ? normalizeBrokerUrl(data.broker_url) : existing.broker_url;
    const base_topic = data.base_topic !== undefined ? data.base_topic.trim() : existing.base_topic;
    const username = data.username !== undefined ? data.username.trim() : existing.username;
    const password = data.password !== undefined ? data.password : existing.password;
    const enabled = data.enabled !== undefined ? (data.enabled ? 1 : 0) : existing.enabled;

    db.prepare(`
      UPDATE z2m_hubs
      SET name = ?, broker_url = ?, base_topic = ?, username = ?, password = ?, enabled = ?
      WHERE id = ?
    `).run(name, broker_url, base_topic, username, password, enabled, id);

    const updated: Z2mHubRecord = {
      ...existing,
      name,
      broker_url,
      base_topic,
      username,
      password,
      enabled,
    };

    if (enabled === 1) {
      this.connectHub(updated);
    } else {
      this.disconnectHub(id);
      this.hubConnections.set(id, {
        hub: updated,
        client: null,
        connected: false,
        bridgeState: 'unknown',
        lastError: null,
      });
    }

    this.broadcastStatus();
    liveSync.broadcast('bootstrap_updated');
    return updated;
  }

  public deleteHub(id: string): boolean {
    this.disconnectHub(id);
    this.hubConnections.delete(id);

    // Remove discovered devices belonging to this hub
    for (const [key, dev] of this.discoveredDevices.entries()) {
      if (dev.hub_id === id) {
        this.discoveredDevices.delete(key);
      }
    }

    db.prepare('DELETE FROM z2m_hubs WHERE id = ?').run(id);

    this.broadcastStatus();
    liveSync.broadcast('bootstrap_updated');
    return true;
  }

  // Legacy single form backward compatibility
  public updateConfigAndReconnect(config: {
    enabled: boolean;
    brokerUrl: string;
    username?: string;
    password?: string;
    baseTopic?: string;
  }) {
    const existing = db.prepare('SELECT id FROM z2m_hubs ORDER BY sort_order ASC LIMIT 1').get() as { id: string } | undefined;
    if (existing) {
      this.updateHub(existing.id, {
        enabled: config.enabled,
        broker_url: config.brokerUrl,
        username: config.username,
        password: config.password,
        base_topic: config.baseTopic,
      });
    } else {
      this.addHub({
        name: 'Coordinator 1 (Primary)',
        enabled: config.enabled,
        broker_url: config.brokerUrl,
        username: config.username,
        password: config.password,
        base_topic: config.baseTopic,
      });
    }
  }

  public broadcastStatus() {
    liveSync.broadcast('z2m_status_changed', this.getStatus());
  }

  // Auto-import discovered devices across all coordinators
  public autoImportDevices(floorId?: string, roomId?: string) {
    const discovered = this.getDiscoveredDevices().filter((d) => d.type !== 'Coordinator');
    if (discovered.length === 0) {
      return { count: 0, message: 'No devices found to import' };
    }

    let targetRoomId = roomId;
    if (!targetRoomId) {
      let firstRoom = db.prepare('SELECT id FROM rooms ORDER BY sort_order ASC, name ASC LIMIT 1').get() as { id: string } | undefined;
      if (!firstRoom) {
        let firstFloor = db.prepare('SELECT id FROM floors ORDER BY sort_order ASC LIMIT 1').get() as { id: string } | undefined;
        if (!firstFloor) {
          const fid = `floor_${crypto.randomBytes(4).toString('hex')}`;
          db.prepare('INSERT INTO floors (id, name, slug) VALUES (?, ?, ?)').run(fid, 'Floor 1', 'floor1');
          firstFloor = { id: fid };
        }
        const rid = `room_${crypto.randomBytes(4).toString('hex')}`;
        db.prepare('INSERT INTO rooms (id, floor_id, name, slug) VALUES (?, ?, ?, ?)').run(rid, firstFloor.id, 'Main Office', 'main_office');
        firstRoom = { id: rid };
      }
      targetRoomId = firstRoom.id;
    }

    let importedCount = 0;

    for (const d of discovered) {
      const existing = db.prepare('SELECT id FROM devices WHERE z2m_friendly_name = ? OR z2m_friendly_name = ? OR name = ?').get(
        d.friendly_name,
        d.ieee_address,
        d.friendly_name
      );

      if (existing) continue;

      let devType = 'switch_light';
      const exposes = d.definition?.exposes || [];
      const hasLight = exposes.some((e: any) => e.type === 'light' || e.features?.some((f: any) => f.name === 'brightness'));
      const hasCover = exposes.some((e: any) => e.type === 'cover' || e.name === 'cover');
      const hasOccupancy = exposes.some((e: any) => e.name === 'occupancy' || e.property === 'occupancy');
      const hasClimate = exposes.some((e: any) => e.type === 'climate');
      const hasAirQuality = exposes.some((e: any) => e.name === 'co2' || e.name === 'formaldehyd' || e.name === 'voc' || e.property === 'co2');
      const hasEnergyMeter = exposes.some((e: any) => e.name === 'energy' || e.name === 'power_a' || e.name === 'power' || e.property === 'energy' || e.property === 'power_a');
      const hasKnob = exposes.some((e: any) => e.name === 'action' || e.property === 'action') || d.definition?.model?.toLowerCase().includes('knob') || d.friendly_name.toLowerCase().includes('knob');

      if (hasLight) {
        devType = 'dimmable_light';
      } else if (hasCover) {
        devType = 'cover';
      } else if (hasAirQuality) {
        devType = 'environmental_sensor';
      } else if (hasEnergyMeter) {
        devType = 'energy_meter';
      } else if (hasKnob) {
        devType = 'smart_knob';
      } else if (hasOccupancy) {
        devType = 'presence_sensor';
      } else if (hasClimate) {
        devType = 'climate';
      }

      let displayName = d.friendly_name;
      if (displayName.startsWith('0x') && d.definition?.description) {
        displayName = d.definition.description;
      }

      const devId = `dev_${crypto.randomBytes(4).toString('hex')}`;
      const devConfig = JSON.stringify({
        z2m_friendly_name: d.friendly_name,
        z2m_ieee: d.ieee_address,
        z2m_base_topic: d.base_topic,
        z2m_hub_id: d.hub_id,
        z2m_hub_name: d.hub_name,
        vendor: d.definition?.vendor || '',
        model: d.definition?.model || '',
        enabled_controls: hasLight
          ? ['brightness', 'color_temp', 'power_wattage']
          : hasAirQuality
          ? ['co2', 'temp', 'humidity', 'voc', 'formaldehyd']
          : hasEnergyMeter
          ? ['power', 'voltage', 'current', 'energy', 'relay']
          : undefined,
      });

      db.prepare(`
        INSERT INTO devices (id, room_id, type, name, z2m_friendly_name, config_json, show_on_default_dashboard, sort_order)
        VALUES (?, ?, ?, ?, ?, ?, 0, 0)
      `).run(devId, targetRoomId, devType, displayName, d.friendly_name, devConfig);

      importedCount++;
    }

    if (importedCount > 0) {
      liveSync.broadcast('bootstrap_updated');
    }

    return {
      count: importedCount,
      message: `Successfully imported ${importedCount} Zigbee devices into room`,
    };
  }
}

export const mqttService = new MqttService();
