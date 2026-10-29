import { Router } from 'express';
import { db } from '../db/index.js';
import { getUserFromToken } from './auth.js';
import { mqttService } from '../services/mqttService.js';

const router = Router();

router.get('/', (req, res) => {
  try {
    const config = db.prepare('SELECT * FROM building_config WHERE id = 1').get() as any;
    const hubs = db.prepare('SELECT id, name, local_url, cloud_url, access_token, enabled, sort_order FROM ha_hubs ORDER BY sort_order ASC, name ASC').all();
    const floors = db.prepare('SELECT * FROM floors ORDER BY sort_order ASC, name ASC').all();
    const rooms = db.prepare('SELECT * FROM rooms ORDER BY sort_order ASC, name ASC').all();
    const devices = db.prepare('SELECT * FROM devices ORDER BY sort_order ASC, name ASC').all();
    const cameras = db.prepare('SELECT * FROM cameras ORDER BY sort_order ASC, name ASC').all();
    const ir_profiles = db.prepare('SELECT id, name, brand FROM ir_profiles ORDER BY name ASC').all();
    const automations = db.prepare('SELECT * FROM automations ORDER BY name ASC').all();
    const virtualRows = db.prepare('SELECT * FROM virtual_device_states').all() as any[];

    const virtual_device_states: Record<string, any> = {};
    for (const v of virtualRows) {
      try {
        virtual_device_states[v.device_id] = JSON.parse(v.state_json);
      } catch (_) {}
    }

    const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;

    // Check logged in user
    const token = req.cookies?.token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    const user = getUserFromToken(token);

    // Filter sensitive config fields for public bootstrap
    const safeConfig = { ...config };
    delete safeConfig.ttlock_password_md5;
    delete safeConfig.ttlock_access_token;
    delete safeConfig.hr_auth_token;
    delete safeConfig.mqtt_password;

    return res.json({
      config: safeConfig,
      z2m_status: mqttService.getStatus(),
      hubs,
      floors,
      rooms,
      devices,
      cameras,
      ir_profiles,
      automations,
      virtual_device_states,
      user_count: userCount,
      user: user
        ? {
            id: user.id,
            name: user.name,
            email: user.email,
            phone: user.phone,
            role: user.role,
            default_room_id: user.default_room_id,
            theme_preference: user.theme_preference,
            favorites_json: user.favorites_json,
          }
        : null,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
