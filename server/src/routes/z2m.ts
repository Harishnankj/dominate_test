import { Router } from 'express';
import { mqttService } from '../services/mqttService.js';

const router = Router();

// 1. Get Zigbee2MQTT Status & cached device states
router.get('/status', (req, res) => {
  try {
    const status = mqttService.getStatus();
    const states = mqttService.getAllDeviceStates();
    return res.json({ ok: true, status, states });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. Get list of discovered Zigbee devices
router.get('/devices', (req, res) => {
  try {
    const devices = mqttService.getDiscoveredDevices();
    return res.json({ ok: true, count: devices.length, devices });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. Set Device State directly via Zigbee2MQTT
router.post('/set', async (req, res) => {
  try {
    const { friendly_name, state } = req.body;
    if (!friendly_name) {
      return res.status(400).json({ error: 'friendly_name is required' });
    }
    if (!state || typeof state !== 'object') {
      return res.status(400).json({ error: 'state object is required' });
    }

    await mqttService.setDeviceState(friendly_name, state);
    return res.json({ ok: true, friendly_name, state });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 4. Update MQTT Broker Settings & Reconnect
router.post('/config', (req, res) => {
  try {
    const { enabled, brokerUrl, username, password, baseTopic } = req.body;
    mqttService.updateConfigAndReconnect({
      enabled: Boolean(enabled),
      brokerUrl: brokerUrl || 'mqtt://127.0.0.1:1883',
      username: username || '',
      password: password !== undefined ? password : undefined,
      baseTopic: baseTopic || 'zigbee2mqtt',
    });

    return res.json({ ok: true, status: mqttService.getStatus() });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Toggle Permit Join (Pairing Mode)
router.post('/permit-join', async (req, res) => {
  try {
    const time = typeof req.body.time === 'number' ? req.body.time : 254;
    await mqttService.permitJoin(time);
    return res.json({ ok: true, time, permit_join: time > 0 });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 6. 1-Click Auto-Import Discovered Zigbee Devices
router.post('/auto-import', (req, res) => {
  try {
    const { floorId, roomId } = req.body;
    const result = mqttService.autoImportDevices(floorId, roomId);
    return res.json({ ok: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;

