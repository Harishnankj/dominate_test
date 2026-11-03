import { Router } from 'express';
import { tuyaService } from '../services/tuyaService.js';
import { db } from '../db/index.js';
import crypto from 'crypto';
import { liveSync } from '../websocket/liveSync.js';

const router = Router();

// 1. Get Tuya Hub Status & cached device states
router.get('/status', (req, res) => {
  try {
    const status = tuyaService.getStatus();
    const states = tuyaService.getAllDeviceStates();
    return res.json({ ok: true, status, states });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Get list of discovered Tuya / Smart Life devices
router.get('/devices', (req, res) => {
  try {
    const devices = tuyaService.getDiscoveredDevices();
    return res.json({ ok: true, count: devices.length, devices });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Trigger Cloud Sync & Local Discovery
router.post('/sync', async (req, res) => {
  try {
    const result = await tuyaService.syncFromCloud();
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 4. Set Device State directly via Tuya (Local LAN / Cloud fallback)
router.post('/set', async (req, res) => {
  try {
    const { device_id, state } = req.body;
    if (!device_id) {
      return res.status(400).json({ error: 'device_id is required' });
    }
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ error: 'state object is required' });
    }

    await tuyaService.setDeviceState(device_id, state);
    return res.json({ ok: true, device_id, state });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 5. Update Tuya Developer Cloud Credentials
router.post('/config', (req, res) => {
  try {
    const { enabled, accessId, accessSecret, region, uid } = req.body;
    tuyaService.updateConfig({
      enabled: Boolean(enabled),
      accessId: accessId || '',
      accessSecret: accessSecret !== undefined ? accessSecret : undefined,
      region: region || 'in',
      uid: uid || '',
    });

    return res.json({ ok: true, status: tuyaService.getStatus() });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6. 1-Click Auto-Import Discovered Tuya Devices into Rooms
router.post('/auto-import', (req, res) => {
  try {
    const { floorId, roomId } = req.body;
    const result = tuyaService.autoImportDevices(floorId, roomId);
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 7. Manually add a standalone Tuya/Wi-Fi device
router.post('/devices/manual', (req, res) => {
  try {
    const { name, tuya_device_id, tuya_local_key, tuya_ip, type, room_id } = req.body;
    if (!name || !tuya_device_id || !room_id) {
      return res.status(400).json({ error: 'name, tuya_device_id, and room_id are required' });
    }

    const devId = `dev_${crypto.randomBytes(4).toString('hex')}`;
    const devType = type || 'switch_light';

    db.prepare(`
      INSERT INTO devices (id, room_id, type, name, subtitle, tuya_device_id, tuya_local_key, tuya_ip, tuya_protocol_version, config_json, show_on_default_dashboard, sort_order)
      VALUES (?, ?, ?, ?, 'Direct Wi-Fi', ?, ?, ?, '3.3', '{}', 0, 0)
    `).run(devId, room_id, devType, name.trim(), tuya_device_id.trim(), (tuya_local_key || '').trim(), (tuya_ip || '').trim());

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true, id: devId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

