import { Router } from 'express';
import { db } from '../db/index.js';
import { HaService } from '../services/haService.js';
import { liveSync } from '../websocket/liveSync.js';
import { TTLockService } from '../services/ttlockService.js';

const router = Router();

// Store virtual device state (e.g. AC IR or relay blinds)
router.post('/:id/virtual-state', (req, res) => {
  try {
    const { id } = req.params;
    const { state } = req.body;
    if (!state) return res.status(400).json({ error: 'state payload required' });

    db.prepare(`
      INSERT INTO virtual_device_states (device_id, state_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(device_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at
    `).run(id, JSON.stringify(state), Date.now());

    liveSync.broadcast('virtual_state_updated', { deviceId: id, state });
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Send AC IR Command
router.post('/ac-ir/send', async (req, res) => {
  try {
    const { deviceId, commandKey, stateSnapshot } = req.body;
    if (!deviceId || !commandKey) {
      return res.status(400).json({ error: 'deviceId and commandKey are required' });
    }

    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId) as any;
    if (!device) return res.status(404).json({ error: 'Device not found' });

    let devConfig: any = {};
    try { devConfig = JSON.parse(device.config_json); } catch (_) {}

    const irProfileId = devConfig.ir_profile_id;
    const profile = irProfileId ? db.prepare('SELECT commands_json FROM ir_profiles WHERE id = ?').get(irProfileId) as any : null;
    let commands: Record<string, string> = {};
    if (profile) {
      try { commands = JSON.parse(profile.commands_json); } catch (_) {}
    }

    const irCode = commands[commandKey];
    if (!irCode) {
      return res.status(400).json({ error: `Command "${commandKey}" not found in IR profile` });
    }

    // Resolve Hub
    let hubId = device.ha_hub_id;
    if (!hubId) {
      const room = db.prepare('SELECT ha_hub_id FROM rooms WHERE id = ?').get(device.room_id) as any;
      hubId = room?.ha_hub_id;
    }
    const hub = hubId
      ? (db.prepare('SELECT * FROM ha_hubs WHERE id = ?').get(hubId) as any)
      : (db.prepare('SELECT * FROM ha_hubs WHERE enabled = 1 LIMIT 1').get() as any);

    if (!hub) return res.status(400).json({ error: 'No Home Assistant hub available' });

    // Send code to HA text entity
    await HaService.callService(hub.local_url, hub.access_token, 'text', 'set_value', {
      entity_id: device.entity_id,
      value: irCode,
    });

    // Update virtual state
    if (stateSnapshot) {
      db.prepare(`
        INSERT INTO virtual_device_states (device_id, state_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(device_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at
      `).run(deviceId, JSON.stringify(stateSnapshot), Date.now());

      liveSync.broadcast('virtual_state_updated', { deviceId, state: stateSnapshot });
    }

    return res.json({ ok: true, commandKey, entityId: device.entity_id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Control Motorized Blinds Relay
router.post('/relay-blinds/move', async (req, res) => {
  try {
    const { deviceId, action } = req.body; // 'open', 'close', 'stop'
    if (!deviceId || !action) return res.status(400).json({ error: 'deviceId and action are required' });

    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId) as any;
    if (!device) return res.status(404).json({ error: 'Device not found' });

    let devConfig: any = {};
    try { devConfig = JSON.parse(device.config_json); } catch (_) {}

    const upEntity = devConfig.up_entity_id;
    const downEntity = devConfig.down_entity_id;
    const travelMs = devConfig.travel_ms || 20000;

    let hubId = device.ha_hub_id;
    if (!hubId) {
      const room = db.prepare('SELECT ha_hub_id FROM rooms WHERE id = ?').get(device.room_id) as any;
      hubId = room?.ha_hub_id;
    }
    const hub = hubId
      ? (db.prepare('SELECT * FROM ha_hubs WHERE id = ?').get(hubId) as any)
      : (db.prepare('SELECT * FROM ha_hubs WHERE enabled = 1 LIMIT 1').get() as any);

    if (!hub) return res.status(400).json({ error: 'No Home Assistant hub available' });

    if (action === 'open' && upEntity) {
      // First ensure down entity is off
      if (downEntity) {
        await HaService.callService(hub.local_url, hub.access_token, 'switch', 'turn_off', { entity_id: downEntity }).catch(() => {});
      }
      await HaService.callService(hub.local_url, hub.access_token, 'switch', 'turn_on', { entity_id: upEntity });
      // Schedule auto turn off after travel time
      setTimeout(() => {
        HaService.callService(hub.local_url, hub.access_token, 'switch', 'turn_off', { entity_id: upEntity }).catch(() => {});
      }, travelMs);
    } else if (action === 'close' && downEntity) {
      if (upEntity) {
        await HaService.callService(hub.local_url, hub.access_token, 'switch', 'turn_off', { entity_id: upEntity }).catch(() => {});
      }
      await HaService.callService(hub.local_url, hub.access_token, 'switch', 'turn_on', { entity_id: downEntity });
      setTimeout(() => {
        HaService.callService(hub.local_url, hub.access_token, 'switch', 'turn_off', { entity_id: downEntity }).catch(() => {});
      }, travelMs);
    } else if (action === 'stop') {
      if (upEntity) await HaService.callService(hub.local_url, hub.access_token, 'switch', 'turn_off', { entity_id: upEntity });
      if (downEntity) await HaService.callService(hub.local_url, hub.access_token, 'switch', 'turn_off', { entity_id: downEntity });
    }

    // Update virtual state
    const targetPos = action === 'open' ? 100 : action === 'close' ? 0 : 50;
    const vState = { position: targetPos, action, moving: action !== 'stop', last_action_time: Date.now() };
    db.prepare(`
      INSERT INTO virtual_device_states (device_id, state_json, updated_at)
      VALUES (?, ?, ?)
      ON CONFLICT(device_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at
    `).run(deviceId, JSON.stringify(vState), Date.now());

    liveSync.broadcast('virtual_state_updated', { deviceId, state: vState });

    return res.json({ ok: true, action });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Proxy call HA service via server (avoids browser CORS or direct websocket blocking)
router.post('/ha-call', async (req, res) => {
  try {
    const { hub_id, domain, service, service_data } = req.body;
    let hub: any = null;
    if (hub_id) {
      hub = db.prepare('SELECT * FROM ha_hubs WHERE id = ?').get(hub_id);
    }
    if (!hub) {
      hub = db.prepare('SELECT * FROM ha_hubs WHERE enabled = 1 LIMIT 1').get();
    }
    if (!hub) {
      return res.status(400).json({ error: 'No Home Assistant hub available' });
    }

    const result = await HaService.callService(hub.local_url, hub.access_token, domain, service, service_data || {});
    return res.json({ ok: true, result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Lock all building doors (TTLock and smart locks)
router.post('/lock-all', async (_req, res) => {
  try {
    const config = db.prepare('SELECT ttlock_client_id, ttlock_access_token, ttlock_legacy_url FROM building_config WHERE id = 1').get() as any;
    const ttlockDevices = db.prepare("SELECT * FROM devices WHERE type = 'ttlock'").all() as any[];
    let locked = 0;
    const results: any[] = [];

    for (const dev of ttlockDevices) {
      let devConfig: any = {};
      try { devConfig = JSON.parse(dev.config_json); } catch (_) {}
      const lockId = devConfig.lockId || dev.entity_id;
      if (lockId && config?.ttlock_access_token) {
        try {
          const lockRes = await TTLockService.lock(config.ttlock_client_id, config.ttlock_access_token, lockId);
          if (lockRes.ok) locked++;
          results.push({ id: dev.id, name: dev.name, ...lockRes });
        } catch (e: any) {
          results.push({ id: dev.id, name: dev.name, ok: false, error: e.message });
        }
      }
    }

    return res.json({ ok: true, total: ttlockDevices.length, locked, results });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
