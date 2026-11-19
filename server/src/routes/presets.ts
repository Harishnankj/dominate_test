import { Router } from 'express';
import { db } from '../db/index.js';
import { liveSync } from '../websocket/liveSync.js';
import { automationScheduler } from '../scheduler.js';
import { mqttService } from '../services/mqttService.js';
import { tuyaService } from '../services/tuyaService.js';
import { HaService } from '../services/haService.js';
import { TTLockService } from '../services/ttlockService.js';

export const DEFAULT_PRESET_SCENES = [
  {
    id: 'work_mode',
    name: 'Work Mode',
    desc: 'Optimized 4000K daylight lighting, comfortable 23°C climate',
    icon: 'Sun',
    accent_color: 'text-[#F0B94D]',
    actions_json: JSON.stringify([
      { type: 'directive', target: 'lights', state: 'ON', brightness: 85, color_temp: 350 },
      { type: 'directive', target: 'climate', state: 'ON', temp: 23 },
    ]),
    sort_order: 1,
  },
  {
    id: 'meeting_mode',
    name: 'Meeting Mode',
    desc: 'Conference lighting & presentation ambience across rooms',
    icon: 'Sparkles',
    accent_color: 'text-[#22D68A]',
    actions_json: JSON.stringify([
      { type: 'directive', target: 'lights', state: 'ON', brightness: 60 },
    ]),
    sort_order: 2,
  },
  {
    id: 'night_mode',
    name: 'Night Mode',
    desc: 'Secure all building entrances and power down work fixtures',
    icon: 'Moon',
    accent_color: 'text-indigo-400',
    actions_json: JSON.stringify([
      { type: 'directive', target: 'locks', action: 'lock' },
      { type: 'directive', target: 'lights', state: 'OFF' },
    ]),
    sort_order: 3,
  },
  {
    id: 'all_off',
    name: 'All Off',
    desc: 'Emergency / end-of-day shutoff for all lighting and fixtures',
    icon: 'Power',
    accent_color: 'text-[#FF5757]',
    actions_json: JSON.stringify([
      { type: 'directive', target: 'lights', state: 'OFF' },
      { type: 'directive', target: 'plugs', state: 'OFF' },
    ]),
    sort_order: 4,
  },
];

const router = Router();

export function seedDefaultPresets() {
  const now = new Date().toISOString();
  for (const p of DEFAULT_PRESET_SCENES) {
    db.prepare(`
      INSERT OR IGNORE INTO preset_scenes (id, name, desc, icon, accent_color, actions_json, is_active, sort_order, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `).run(p.id, p.name, p.desc, p.icon, p.accent_color, p.actions_json, p.sort_order, now);
  }
}

// GET all presets
router.get('/', (req, res) => {
  try {
    let presets = db.prepare('SELECT * FROM preset_scenes ORDER BY sort_order ASC, name ASC').all();
    if (!presets || presets.length === 0) {
      seedDefaultPresets();
      presets = db.prepare('SELECT * FROM preset_scenes ORDER BY sort_order ASC, name ASC').all();
    }
    return res.json({ ok: true, presets });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update a preset (Admin)
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, desc, icon, accent_color, actions_json, is_active, sort_order } = req.body;
    const now = new Date().toISOString();

    const existing = db.prepare('SELECT * FROM preset_scenes WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ error: `Preset scene ${id} not found` });
    }

    db.prepare(`
      UPDATE preset_scenes SET
        name = COALESCE(?, name),
        desc = COALESCE(?, desc),
        icon = COALESCE(?, icon),
        accent_color = COALESCE(?, accent_color),
        actions_json = COALESCE(?, actions_json),
        is_active = COALESCE(?, is_active),
        sort_order = COALESCE(?, sort_order),
        updated_at = ?
      WHERE id = ?
    `).run(
      name !== undefined ? name : null,
      desc !== undefined ? desc : null,
      icon !== undefined ? icon : null,
      accent_color !== undefined ? accent_color : null,
      actions_json !== undefined ? (typeof actions_json === 'string' ? actions_json : JSON.stringify(actions_json)) : null,
      is_active !== undefined ? (is_active ? 1 : 0) : null,
      sort_order !== undefined ? Number(sort_order) : null,
      now,
      id
    );

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true, message: 'Preset updated successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Reset preset to factory default
router.post('/:id/reset', (req, res) => {
  try {
    const { id } = req.params;
    const defaultItem = DEFAULT_PRESET_SCENES.find((p) => p.id === id);
    if (!defaultItem) {
      return res.status(404).json({ error: `Default definition for ${id} not found` });
    }

    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO preset_scenes (id, name, desc, icon, accent_color, actions_json, is_active, sort_order, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        desc = excluded.desc,
        icon = excluded.icon,
        accent_color = excluded.accent_color,
        actions_json = excluded.actions_json,
        is_active = 1,
        sort_order = excluded.sort_order,
        updated_at = excluded.updated_at
    `).run(
      defaultItem.id,
      defaultItem.name,
      defaultItem.desc,
      defaultItem.icon,
      defaultItem.accent_color,
      defaultItem.actions_json,
      defaultItem.sort_order,
      now
    );

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true, message: 'Preset reset to factory default' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Run / Actuate preset
router.post('/:id/run', async (req, res) => {
  try {
    const { id } = req.params;
    const preset = db.prepare('SELECT * FROM preset_scenes WHERE id = ?').get(id) as any;
    if (!preset) {
      return res.status(404).json({ error: `Preset scene ${id} not found` });
    }

    let actions: any[] = [];
    try {
      actions = JSON.parse(preset.actions_json || '[]');
    } catch (_) {}

    let executed = 0;
    const allDevices = db.prepare('SELECT * FROM devices').all() as any[];

    for (const item of actions) {
      try {
        // Directives
        if (item.target === 'lights' || item.type === 'all_lights') {
          const state = (item.state || 'ON').toUpperCase();
          const brightnessPct = item.brightness !== undefined ? item.brightness : 80;
          const brightnessZ2m = Math.round((brightnessPct / 100) * 254);
          const colorTemp = item.color_temp ?? 350;

          for (const dev of allDevices) {
            let devConfig: any = {};
            try { devConfig = JSON.parse(dev.config_json); } catch (_) {}
            const zName = dev.z2m_friendly_name || devConfig.z2m_friendly_name;
            const tuyaId = dev.tuya_device_id || devConfig.tuya_device_id;

            if (dev.type === 'dimmable_light') {
              if (state === 'ON') {
                if (zName) await mqttService.setDeviceState(zName, { state: 'ON', brightness: brightnessZ2m, color_temp: colorTemp }).catch(() => {});
                if (tuyaId) await tuyaService.setDeviceState(tuyaId, { switch_led: true, bright_value_v2: brightnessPct * 10 }).catch(() => {});
              } else {
                if (zName) await mqttService.setDeviceState(zName, { state: 'OFF' }).catch(() => {});
                if (tuyaId) await tuyaService.setDeviceState(tuyaId, { switch_led: false }).catch(() => {});
              }
              executed++;
            } else if (dev.type === 'switch_light') {
              if (state === 'ON') {
                if (zName) await mqttService.setDeviceState(zName, { state: 'ON' }).catch(() => {});
                if (tuyaId) await tuyaService.setDeviceState(tuyaId, { switch_1: true }).catch(() => {});
              } else {
                if (zName) await mqttService.setDeviceState(zName, { state: 'OFF' }).catch(() => {});
                if (tuyaId) await tuyaService.setDeviceState(tuyaId, { switch_1: false }).catch(() => {});
              }
              executed++;
            }
          }
        } else if (item.target === 'locks') {
          const config = db.prepare('SELECT ttlock_client_id, ttlock_access_token, ttlock_legacy_url FROM building_config WHERE id = 1').get() as any;
          const ttlockDevices = allDevices.filter((d) => d.type === 'ttlock');
          for (const dev of ttlockDevices) {
            let devConfig: any = {};
            try { devConfig = JSON.parse(dev.config_json); } catch (_) {}
            const lockId = devConfig.lockId || dev.entity_id;
            if (lockId && config?.ttlock_access_token) {
              if (item.action === 'lock') {
                await TTLockService.lock(config.ttlock_client_id, config.ttlock_access_token, lockId).catch(() => {});
              } else if (item.action === 'unlock') {
                await TTLockService.unlock(config.ttlock_client_id, config.ttlock_access_token, lockId, config.ttlock_legacy_url).catch(() => {});
              }
              executed++;
            }
          }
        } else if (item.target === 'plugs') {
          const state = (item.state || 'OFF').toUpperCase();
          for (const dev of allDevices) {
            if (dev.type === 'switch_light' || dev.type === 'exhaust_fan') {
              let devConfig: any = {};
              try { devConfig = JSON.parse(dev.config_json); } catch (_) {}
              const zName = dev.z2m_friendly_name || devConfig.z2m_friendly_name;
              const tuyaId = dev.tuya_device_id || devConfig.tuya_device_id;
              if (state === 'OFF') {
                if (zName) await mqttService.setDeviceState(zName, { state: 'OFF' }).catch(() => {});
                if (tuyaId) await tuyaService.setDeviceState(tuyaId, { switch_1: false }).catch(() => {});
              } else {
                if (zName) await mqttService.setDeviceState(zName, { state: 'ON' }).catch(() => {});
                if (tuyaId) await tuyaService.setDeviceState(tuyaId, { switch_1: true }).catch(() => {});
              }
              executed++;
            }
          }
        } else if (item.device_id) {
          // Specific device step
          await automationScheduler.executeStep(item);
          executed++;
        }
      } catch (err: any) {
        console.warn('[Presets] Action step failed:', err.message);
      }
    }

    liveSync.broadcast('preset_executed', { id: preset.id, name: preset.name });
    return res.json({ ok: true, success: true, name: preset.name, executedActions: executed });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
