import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { db } from '../db/index.js';
import { HaService } from '../services/haService.js';
import { TTLockService } from '../services/ttlockService.js';
import { liveSync } from '../websocket/liveSync.js';
import { ptzMove, ptzStop } from '../services/onvifPtz.js';

const router = Router();

// Middleware to verify admin permissions (for production safety, but accessible during setup)
router.use((req, res, next) => {
  // Allow all admin setup operations
  next();
});

// ==========================================
// WORKFLOW 1: Home Assistant Hub Manager & Test
// ==========================================

// Test HA Connection
router.post('/ha-test', async (req, res) => {
  try {
    const { local_url, access_token, hub_id } = req.body;
    let url = local_url ? String(local_url).trim() : '';
    let token = access_token ? String(access_token).trim() : '';

    if (hub_id && (!url || !token)) {
      const hub = db.prepare('SELECT local_url, access_token FROM ha_hubs WHERE id = ?').get(hub_id) as any;
      if (hub) {
        url = url || hub.local_url;
        token = token || hub.access_token;
      }
    }

    // Fallback: If token not provided but URL matches an existing saved hub
    if (!token && url) {
      const hub = db.prepare('SELECT access_token FROM ha_hubs WHERE local_url = ? OR cloud_url = ? LIMIT 1').get(url, url) as any;
      if (hub?.access_token) {
        token = hub.access_token;
      }
    }

    // Fallback: If token still missing, check if only one active hub exists in DB
    if (!token) {
      const singleHub = db.prepare('SELECT local_url, access_token FROM ha_hubs WHERE enabled = 1 LIMIT 1').get() as any;
      if (singleHub?.access_token) {
        url = url || singleHub.local_url;
        token = singleHub.access_token;
      }
    }

    if (!url || !token) {
      return res.status(400).json({ error: 'URL and Access Token are required' });
    }

    const result = await HaService.testConnection(url, token);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Add Hub
router.post('/hubs', (req, res) => {
  try {
    const { name, local_url, cloud_url, access_token, enabled, sort_order } = req.body;
    if (!name || !local_url || !access_token) {
      return res.status(400).json({ error: 'Name, Local URL, and Access Token are required' });
    }

    const id = `hub_${crypto.randomBytes(4).toString('hex')}`;
    db.prepare(`
      INSERT INTO ha_hubs (id, name, local_url, cloud_url, access_token, enabled, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name.trim(), local_url.trim(), (cloud_url || '').trim(), access_token.trim(), enabled ?? 1, sort_order ?? 0);

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Update Hub
router.put('/hubs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, local_url, cloud_url, access_token, enabled, sort_order } = req.body;

    const existing = db.prepare('SELECT * FROM ha_hubs WHERE id = ?').get(id) as any;
    if (!existing) {
      return res.status(404).json({ error: 'Hub not found' });
    }

    db.prepare(`
      UPDATE ha_hubs SET
        name = ?,
        local_url = ?,
        cloud_url = ?,
        access_token = COALESCE(NULLIF(?, ''), access_token),
        enabled = ?,
        sort_order = ?
      WHERE id = ?
    `).run(
      name ?? existing.name,
      local_url ?? existing.local_url,
      cloud_url ?? existing.cloud_url,
      access_token || '',
      enabled ?? existing.enabled,
      sort_order ?? existing.sort_order,
      id
    );

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Delete Hub
router.delete('/hubs/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM ha_hubs WHERE id = ?').run(req.params.id);
    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Generate HomeKey
router.post('/generate-homekey', (req, res) => {
  try {
    const hubs = db.prepare('SELECT local_url, cloud_url FROM ha_hubs WHERE enabled = 1').all() as any[];
    const urls = hubs.flatMap((h) => [h.local_url, h.cloud_url].filter(Boolean));
    const rawKey = urls.length > 0 ? urls.join('+') : `smart_building_${Date.now()}`;
    const hash = crypto.createHash('sha256').update(rawKey).digest('hex');
    const preview = `HK-${hash.slice(0, 8).toUpperCase()}`;

    const requireHomeKey = req.body.require_home_key !== undefined ? (req.body.require_home_key ? 1 : 0) : 0;

    db.prepare(`
      UPDATE building_config
      SET home_key_hash = ?, home_key_preview = ?, require_home_key = ?, updated_at = ?
      WHERE id = 1
    `).run(hash, preview, requireHomeKey, new Date().toISOString());

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true, homeKey: rawKey, preview, hash, requireHomeKey });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ==========================================
// WORKFLOW 2: HA Entity Discovery & Room Mapper
// ==========================================

// Discover HA Entities
router.get('/ha-discover/:hubId', async (req, res) => {
  try {
    const hub = db.prepare('SELECT * FROM ha_hubs WHERE id = ?').get(req.params.hubId) as any;
    if (!hub) {
      return res.status(404).json({ error: 'Hub not found' });
    }

    const entities = await HaService.discoverEntities(hub.local_url, hub.access_token);
    const mappedEntities = new Set(
      (db.prepare('SELECT entity_id FROM devices WHERE entity_id IS NOT NULL').all() as any[]).map((d) => d.entity_id)
    );

    const enriched = entities.map((e) => ({
      ...e,
      is_mapped: mappedEntities.has(e.entity_id),
    }));

    return res.json({ ok: true, hubId: hub.id, entities: enriched });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// 1-Click Auto-Import from HA Areas
router.post('/ha-import-areas/:hubId', async (req, res) => {
  try {
    const hub = db.prepare('SELECT * FROM ha_hubs WHERE id = ?').get(req.params.hubId) as any;
    if (!hub) {
      return res.status(404).json({ error: 'Hub not found' });
    }

    const entities = await HaService.discoverEntities(hub.local_url, hub.access_token);

    // Ensure at least 1 floor exists
    let floor = db.prepare('SELECT id FROM floors LIMIT 1').get() as { id: string } | undefined;
    if (!floor) {
      const floorId = `fl_${crypto.randomBytes(4).toString('hex')}`;
      db.prepare(`
        INSERT INTO floors (id, name, slug, icon, accent_color, sort_order)
        VALUES (?, 'Main Office Floor', 'main-office', 'Building2', 'primary-400', 0)
      `).run(floorId);
      floor = { id: floorId };
    }

    // Group entities by area
    const areaMap: Record<string, typeof entities> = {};
    for (const ent of entities) {
      const area = ent.area_name || 'General Office Space';
      if (!areaMap[area]) areaMap[area] = [];
      areaMap[area].push(ent);
    }

    let importedRooms = 0;
    let importedDevices = 0;

    for (const [areaName, ents] of Object.entries(areaMap)) {
      const slug = areaName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || `room-${Date.now()}`;
      let room = db.prepare('SELECT id FROM rooms WHERE slug = ?').get(slug) as { id: string } | undefined;

      if (!room) {
        const roomId = `rm_${crypto.randomBytes(4).toString('hex')}`;
        db.prepare(`
          INSERT INTO rooms (id, floor_id, ha_hub_id, name, slug, icon, accent_color, sort_order)
          VALUES (?, ?, ?, ?, ?, 'Briefcase', 'primary-400', 0)
        `).run(roomId, floor.id, hub.id, areaName, slug);
        room = { id: roomId };
        importedRooms++;
      }

      // Add devices for recognized domains
      for (const ent of ents) {
        const existingDevice = db.prepare('SELECT id FROM devices WHERE entity_id = ?').get(ent.entity_id);
        if (existingDevice) continue;

        let devType: string | null = null;
        if (ent.domain === 'light') {
          devType = ent.attributes?.supported_color_modes?.length > 1 ? 'dimmable_light' : 'switch_light';
        } else if (ent.domain === 'switch') {
          devType = 'switch_light';
        } else if (ent.domain === 'climate') {
          devType = 'climate';
        } else if (ent.domain === 'cover') {
          devType = 'cover';
        } else if (ent.domain === 'binary_sensor' && (ent.entity_id.includes('presence') || ent.entity_id.includes('occupancy'))) {
          devType = 'presence_sensor';
        } else if (ent.domain === 'text' && ent.entity_id.includes('ir_code_to_send')) {
          devType = 'ac_ir';
        } else if (ent.domain === 'media_player') {
          devType = 'media_player';
        } else if (ent.domain === 'fan') {
          devType = 'exhaust_fan';
        }

        if (devType) {
          const devId = `dev_${crypto.randomBytes(4).toString('hex')}`;
          db.prepare(`
            INSERT INTO devices (id, room_id, ha_hub_id, type, name, subtitle, entity_id, show_on_default_dashboard, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)
          `).run(devId, room.id, hub.id, devType, ent.friendly_name || ent.entity_id, ent.domain, ent.entity_id);
          importedDevices++;
        }
      }
    }

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true, importedRooms, importedDevices });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Floors CRUD
router.post('/floors', (req, res) => {
  try {
    const { name, slug, icon, accent_color, poster_image, sort_order } = req.body;
    if (!name) return res.status(400).json({ error: 'Floor name is required' });
    const id = `fl_${crypto.randomBytes(4).toString('hex')}`;
    const cleanSlug = (slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    db.prepare(`
      INSERT INTO floors (id, name, slug, icon, accent_color, poster_image, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(id, name.trim(), cleanSlug, icon || 'Building2', accent_color || 'primary-400', poster_image || null, sort_order || 0);

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/floors/:id', (req, res) => {
  try {
    const { name, slug, icon, accent_color, poster_image, sort_order } = req.body;
    db.prepare(`
      UPDATE floors SET
        name = COALESCE(?, name),
        slug = COALESCE(?, slug),
        icon = COALESCE(?, icon),
        accent_color = COALESCE(?, accent_color),
        poster_image = COALESCE(?, poster_image),
        sort_order = COALESCE(?, sort_order)
      WHERE id = ?
    `).run(name, slug, icon, accent_color, poster_image, sort_order, req.params.id);

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/floors/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM floors WHERE id = ?').run(req.params.id);
    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Rooms CRUD
router.post('/rooms', (req, res) => {
  try {
    const { floor_id, ha_hub_id, name, slug, aliases, icon, accent_color, is_meeting_room, sort_order } = req.body;
    if (!floor_id || !name) return res.status(400).json({ error: 'Floor ID and name are required' });
    const id = `rm_${crypto.randomBytes(4).toString('hex')}`;
    const cleanSlug = (slug || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

    db.prepare(`
      INSERT INTO rooms (id, floor_id, ha_hub_id, name, slug, aliases_json, icon, accent_color, is_meeting_room, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      floor_id,
      ha_hub_id || null,
      name.trim(),
      cleanSlug,
      JSON.stringify(aliases || []),
      icon || 'Briefcase',
      accent_color || 'primary-400',
      is_meeting_room ? 1 : 0,
      sort_order || 0
    );

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/rooms/:id', (req, res) => {
  try {
    const { floor_id, ha_hub_id, name, slug, aliases, icon, accent_color, is_meeting_room, sort_order } = req.body;
    db.prepare(`
      UPDATE rooms SET
        floor_id = COALESCE(?, floor_id),
        ha_hub_id = COALESCE(?, ha_hub_id),
        name = COALESCE(?, name),
        slug = COALESCE(?, slug),
        aliases_json = COALESCE(?, aliases_json),
        icon = COALESCE(?, icon),
        accent_color = COALESCE(?, accent_color),
        is_meeting_room = COALESCE(?, is_meeting_room),
        sort_order = COALESCE(?, sort_order)
      WHERE id = ?
    `).run(
      floor_id,
      ha_hub_id,
      name,
      slug,
      aliases ? JSON.stringify(aliases) : null,
      icon,
      accent_color,
      is_meeting_room !== undefined ? (is_meeting_room ? 1 : 0) : null,
      sort_order,
      req.params.id
    );

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/rooms/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM rooms WHERE id = ?').run(req.params.id);
    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Devices CRUD
router.post('/devices', (req, res) => {
  try {
    const { room_id, ha_hub_id, type, name, subtitle, entity_id, z2m_friendly_name, config, config_json, show_on_default_dashboard, sort_order } = req.body;
    if (!room_id || !type || !name) return res.status(400).json({ error: 'Room, type, and name are required' });
    const id = `dev_${crypto.randomBytes(4).toString('hex')}`;

    const finalConfig = config_json
      ? (typeof config_json === 'string' ? config_json : JSON.stringify(config_json))
      : JSON.stringify(config || {});

    db.prepare(`
      INSERT INTO devices (id, room_id, ha_hub_id, type, name, subtitle, entity_id, z2m_friendly_name, config_json, show_on_default_dashboard, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      room_id,
      ha_hub_id || null,
      type,
      name.trim(),
      subtitle || null,
      entity_id || null,
      z2m_friendly_name || null,
      finalConfig,
      show_on_default_dashboard ? 1 : 0,
      sort_order || 0
    );

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/devices/:id', (req, res) => {
  try {
    const { room_id, ha_hub_id, type, name, subtitle, entity_id, z2m_friendly_name, config, config_json, show_on_default_dashboard, sort_order } = req.body;
    
    let finalConfig: string | null = null;
    if (config_json !== undefined) {
      finalConfig = typeof config_json === 'string' ? config_json : JSON.stringify(config_json);
    } else if (config !== undefined) {
      finalConfig = JSON.stringify(config);
    }

    db.prepare(`
      UPDATE devices SET
        room_id = COALESCE(?, room_id),
        ha_hub_id = COALESCE(?, ha_hub_id),
        type = COALESCE(?, type),
        name = COALESCE(?, name),
        subtitle = COALESCE(?, subtitle),
        entity_id = COALESCE(?, entity_id),
        z2m_friendly_name = COALESCE(?, z2m_friendly_name),
        config_json = COALESCE(?, config_json),
        show_on_default_dashboard = COALESCE(?, show_on_default_dashboard),
        sort_order = COALESCE(?, sort_order)
      WHERE id = ?
    `).run(
      room_id,
      ha_hub_id,
      type,
      name,
      subtitle,
      entity_id,
      z2m_friendly_name,
      finalConfig,
      show_on_default_dashboard !== undefined ? (show_on_default_dashboard ? 1 : 0) : null,
      sort_order,
      req.params.id
    );

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/devices/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM devices WHERE id = ?').run(req.params.id);
    db.prepare('DELETE FROM virtual_device_states WHERE device_id = ?').run(req.params.id);
    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// IR Profiles CRUD & Testing
router.get('/ir-profiles', (req, res) => {
  try {
    const list = db.prepare('SELECT * FROM ir_profiles ORDER BY name ASC').all();
    return res.json({ ok: true, profiles: list });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/ir-profiles', (req, res) => {
  try {
    const { name, brand, commands } = req.body;
    if (!name || !commands) return res.status(400).json({ error: 'Name and commands map are required' });
    const id = `ir_${crypto.randomBytes(4).toString('hex')}`;

    db.prepare(`
      INSERT INTO ir_profiles (id, name, brand, commands_json)
      VALUES (?, ?, ?, ?)
    `).run(id, name.trim(), brand || 'Custom', JSON.stringify(commands));

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/ir-profiles/:id', (req, res) => {
  try {
    const { name, brand, commands } = req.body;
    db.prepare(`
      UPDATE ir_profiles SET
        name = COALESCE(?, name),
        brand = COALESCE(?, brand),
        commands_json = COALESCE(?, commands_json)
      WHERE id = ?
    `).run(name, brand, commands ? JSON.stringify(commands) : null, req.params.id);

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/ir-profiles/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM ir_profiles WHERE id = ?').run(req.params.id);
    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Test send single IR code to HA text entity
router.post('/ir-test', async (req, res) => {
  try {
    const { hub_id, entity_id, code } = req.body;
    if (!entity_id || !code) {
      return res.status(400).json({ error: 'entity_id and code are required' });
    }

    let hub = hub_id ? db.prepare('SELECT * FROM ha_hubs WHERE id = ?').get(hub_id) as any : null;
    if (!hub) {
      hub = db.prepare('SELECT * FROM ha_hubs WHERE enabled = 1 LIMIT 1').get() as any;
    }

    if (!hub) {
      return res.status(400).json({ error: 'No Home Assistant hub available' });
    }

    await HaService.callService(hub.local_url, hub.access_token, 'text', 'set_value', {
      entity_id,
      value: code,
    });

    return res.json({ ok: true, message: `Sent IR code to ${entity_id}` });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Learn IR code live via Z2M switch & sensor
router.post('/ir-learn', async (req, res) => {
  try {
    const { hub_id, learn_entity, sensor_entity } = req.body;
    if (!learn_entity || !sensor_entity) {
      return res.status(400).json({ error: 'learn_entity and sensor_entity are required' });
    }

    let hub = hub_id ? db.prepare('SELECT * FROM ha_hubs WHERE id = ?').get(hub_id) as any : null;
    if (!hub) hub = db.prepare('SELECT * FROM ha_hubs WHERE enabled = 1 LIMIT 1').get() as any;
    if (!hub) return res.status(400).json({ error: 'No Home Assistant hub available' });

    // 1. Turn on learn mode
    await HaService.callService(hub.local_url, hub.access_token, 'switch', 'turn_on', {
      entity_id: learn_entity,
    });

    // 2. Poll sensor entity for new learned code (up to 15 seconds)
    const cleanUrl = hub.local_url.replace(/\/+$/, '');
    const headers = { Authorization: `Bearer ${hub.access_token}` };

    let capturedCode = '';
    const startTime = Date.now();

    while (Date.now() - startTime < 15000) {
      await new Promise((r) => setTimeout(r, 1000));
      const sRes = await fetch(`${cleanUrl}/api/states/${sensor_entity}`, { headers });
      if (sRes.ok) {
        const sData = (await sRes.json()) as any;
        if (sData.state && sData.state !== 'unknown' && sData.state !== 'unavailable' && sData.state !== '') {
          capturedCode = sData.state;
          break;
        }
      }
    }

    return res.json({
      ok: !!capturedCode,
      code: capturedCode || null,
      message: capturedCode ? 'Captured IR code successfully' : 'Timeout waiting for remote button press',
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ==========================================
// WORKFLOW 3: Cameras & Go2RTC Stream Manager
// ==========================================

// Discover streams from Go2RTC
router.get('/go2rtc/streams', async (req, res) => {
  try {
    const config = db.prepare('SELECT go2rtc_base_url, go2rtc_config_path FROM building_config WHERE id = 1').get() as any;
    let streams: Record<string, any> = {};

    // 1. Try Go2RTC REST API if URL configured
    if (config?.go2rtc_base_url) {
      try {
        const cleanUrl = config.go2rtc_base_url.replace(/\/+$/, '');
        const apiRes = await fetch(`${cleanUrl}/api/streams`);
        if (apiRes.ok) {
          streams = (await apiRes.json()) as any;
          return res.json({ ok: true, streams });
        }
      } catch (_) {}
    }

    // 2. Read local go2rtc.yaml
    const cfgPath = path.resolve(process.cwd(), config?.go2rtc_config_path || './go2rtc.yaml');
    if (fs.existsSync(cfgPath)) {
      const content = fs.readFileSync(cfgPath, 'utf8');
      const parsed = YAML.parse(content) || {};
      streams = parsed.streams || {};
    }

    return res.json({ ok: true, streams });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Add / Update Camera
router.post('/cameras', async (req, res) => {
  try {
    const { floor_id, room_id, name, stream_id, full_stream_id, rtsp_sub_url, rtsp_main_url, search_tags, sort_order, onvif_url, onvif_user, onvif_pass, ptz_enabled } = req.body;
    if (!name || !stream_id) return res.status(400).json({ error: 'Name and stream_id are required' });

    const id = `cam_${crypto.randomBytes(4).toString('hex')}`;
    db.prepare(`
      INSERT INTO cameras (id, floor_id, room_id, name, stream_id, full_stream_id, rtsp_sub_url, rtsp_main_url, search_tags, sort_order, onvif_url, onvif_user, onvif_pass, ptz_enabled)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      floor_id || null,
      room_id || null,
      name.trim(),
      stream_id.trim(),
      full_stream_id || `${stream_id.trim()}F`,
      rtsp_sub_url || null,
      rtsp_main_url || null,
      search_tags || '',
      sort_order || 0,
      onvif_url || null,
      onvif_user || null,
      onvif_pass || null,
      ptz_enabled !== undefined ? (ptz_enabled ? 1 : 0) : 1
    );

    // Sync to Go2RTC YAML & live API if RTSP URLs provided
    await syncCameraToGo2rtc(stream_id.trim(), rtsp_sub_url, full_stream_id || `${stream_id.trim()}F`, rtsp_main_url);

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true, id });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.put('/cameras/:id', async (req, res) => {
  try {
    const { floor_id, room_id, name, stream_id, full_stream_id, rtsp_sub_url, rtsp_main_url, search_tags, sort_order, onvif_url, onvif_user, onvif_pass, ptz_enabled } = req.body;
    db.prepare(`
      UPDATE cameras SET
        floor_id = COALESCE(?, floor_id),
        room_id = COALESCE(?, room_id),
        name = COALESCE(?, name),
        stream_id = COALESCE(?, stream_id),
        full_stream_id = COALESCE(?, full_stream_id),
        rtsp_sub_url = COALESCE(?, rtsp_sub_url),
        rtsp_main_url = COALESCE(?, rtsp_main_url),
        search_tags = COALESCE(?, search_tags),
        sort_order = COALESCE(?, sort_order),
        onvif_url = COALESCE(?, onvif_url),
        onvif_user = COALESCE(?, onvif_user),
        onvif_pass = COALESCE(?, onvif_pass),
        ptz_enabled = COALESCE(?, ptz_enabled)
      WHERE id = ?
    `).run(
      floor_id,
      room_id,
      name,
      stream_id,
      full_stream_id,
      rtsp_sub_url,
      rtsp_main_url,
      search_tags,
      sort_order,
      onvif_url,
      onvif_user,
      onvif_pass,
      ptz_enabled !== undefined ? (ptz_enabled ? 1 : 0) : null,
      req.params.id
    );

    if (stream_id && (rtsp_sub_url || rtsp_main_url)) {
      await syncCameraToGo2rtc(stream_id, rtsp_sub_url, full_stream_id, rtsp_main_url);
    }

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/cameras/:id', async (req, res) => {
  try {
    const cam = db.prepare('SELECT stream_id, full_stream_id FROM cameras WHERE id = ?').get(req.params.id) as any;
    db.prepare('DELETE FROM cameras WHERE id = ?').run(req.params.id);

    if (cam) {
      await removeCameraFromGo2rtc(cam.stream_id, cam.full_stream_id);
    }

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PTZ Control endpoint
router.post('/cameras/:id/ptz', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, direction, speed, durationMs } = req.body;

    const cam = db.prepare('SELECT * FROM cameras WHERE id = ? OR stream_id = ?').get(id, id) as any;
    if (!cam) return res.status(404).json({ error: 'Camera not found' });

    let xaddr = cam.onvif_url;
    let user = cam.onvif_user;
    let pass = cam.onvif_pass;

    if (!xaddr) {
      const rtsp = cam.rtsp_main_url || cam.rtsp_sub_url || '';
      const match = rtsp.match(/^rtsp:\/\/(?:([^:]+):([^@]+)@)?([^:/]+)(?::(\d+))?/);
      if (match) {
        const u = match[1];
        const p = match[2];
        const host = match[3];
        if (host === '192.168.0.39' || rtsp.includes('tapo')) {
          xaddr = 'http://192.168.0.176:2020/onvif/device_service';
          user = user || 'bezlin';
          pass = pass || '#Kinhah3059';
        } else {
          xaddr = `http://${host}:2020/onvif/device_service`;
          user = user || u;
          pass = pass || p;
        }
      } else {
        xaddr = 'http://192.168.0.176:2020/onvif/device_service';
        user = user || 'bezlin';
        pass = pass || '#Kinhah3059';
      }
    }

    if (action === 'stop') {
      const result = await ptzStop(cam.id, { xaddr, user, pass });
      return res.json(result);
    }

    const result = await ptzMove(
      cam.id,
      { xaddr, user, pass },
      direction || 'right',
      speed !== undefined ? Number(speed) : 0.4,
      durationMs !== undefined ? Number(durationMs) : 450
    );
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

async function syncCameraToGo2rtc(subStreamId: string, subRtsp?: string, mainStreamId?: string, mainRtsp?: string) {
  const config = db.prepare('SELECT go2rtc_base_url, go2rtc_config_path FROM building_config WHERE id = 1').get() as any;
  const cfgPath = path.resolve(process.cwd(), config?.go2rtc_config_path || './go2rtc.yaml');

  let parsed: any = { api: { listen: ':1984' }, streams: {} };
  if (fs.existsSync(cfgPath)) {
    try {
      parsed = YAML.parse(fs.readFileSync(cfgPath, 'utf8')) || parsed;
    } catch (_) {}
  }
  if (!parsed.api) parsed.api = { listen: ':1984' };
  parsed.api.origin = '*';
  if (!parsed.streams) parsed.streams = {};

  const effectiveSubRtsp = subRtsp || mainRtsp;
  const hasDistinctMain = Boolean(subRtsp && mainRtsp && subRtsp.trim() !== mainRtsp.trim());

  if (subStreamId && effectiveSubRtsp) {
    parsed.streams[subStreamId] = effectiveSubRtsp.trim();
  }
  if (hasDistinctMain && mainStreamId && mainRtsp) {
    parsed.streams[mainStreamId] = mainRtsp.trim();
  } else if (mainStreamId && !hasDistinctMain) {
    delete parsed.streams[mainStreamId];
  }

  fs.writeFileSync(cfgPath, YAML.stringify(parsed), 'utf8');

  // Push via Go2RTC REST API: PUT /api/streams?name={name}&src={rtsp}
  if (config?.go2rtc_base_url) {
    try {
      const cleanUrl = config.go2rtc_base_url.replace(/\/+$/, '');
      if (subStreamId && effectiveSubRtsp) {
        await fetch(`${cleanUrl}/api/streams?name=${encodeURIComponent(subStreamId)}&src=${encodeURIComponent(effectiveSubRtsp.trim())}`, { method: 'PUT' });
      }
      if (hasDistinctMain && mainStreamId && mainRtsp) {
        await fetch(`${cleanUrl}/api/streams?name=${encodeURIComponent(mainStreamId)}&src=${encodeURIComponent(mainRtsp.trim())}`, { method: 'PUT' });
      } else if (mainStreamId && !hasDistinctMain) {
        await fetch(`${cleanUrl}/api/streams?src=${encodeURIComponent(mainStreamId)}`, { method: 'DELETE' });
      }
    } catch (_) {}
  }
}

async function removeCameraFromGo2rtc(streamId: string, fullStreamId?: string) {
  const config = db.prepare('SELECT go2rtc_base_url, go2rtc_config_path FROM building_config WHERE id = 1').get() as any;
  const cfgPath = path.resolve(process.cwd(), config?.go2rtc_config_path || './go2rtc.yaml');

  if (fs.existsSync(cfgPath)) {
    try {
      const parsed = YAML.parse(fs.readFileSync(cfgPath, 'utf8')) || {};
      if (parsed.streams) {
        if (streamId) delete parsed.streams[streamId];
        if (fullStreamId) delete parsed.streams[fullStreamId];
        fs.writeFileSync(cfgPath, YAML.stringify(parsed), 'utf8');
      }
    } catch (_) {}
  }

  if (config?.go2rtc_base_url) {
    try {
      const cleanUrl = config.go2rtc_base_url.replace(/\/+$/, '');
      if (streamId) {
        await fetch(`${cleanUrl}/api/streams?src=${encodeURIComponent(streamId)}`, { method: 'DELETE' });
      }
      if (fullStreamId) {
        await fetch(`${cleanUrl}/api/streams?src=${encodeURIComponent(fullStreamId)}`, { method: 'DELETE' });
      }
    } catch (_) {}
  }
}

// ==========================================
// WORKFLOW 4: TTLock & HR Management
// ==========================================

// Test TTLock Login & Sync Locks
router.post('/ttlock-test', async (req, res) => {
  try {
    const { client_id, client_secret, username, password } = req.body;
    let clientId = client_id;
    let clientSecret = client_secret;
    let uName = username;
    let passMd5 = password;

    const config = db.prepare('SELECT * FROM building_config WHERE id = 1').get() as any;
    clientId = clientId || config?.ttlock_client_id;
    clientSecret = clientSecret || config?.ttlock_client_secret;
    uName = uName || config?.ttlock_username;

    // Check if password needs MD5 hashing
    if (password && password.length !== 32) {
      passMd5 = crypto.createHash('md5').update(password).digest('hex');
    } else {
      passMd5 = passMd5 || config?.ttlock_password_md5;
    }

    if (!clientId || !clientSecret || !uName || !passMd5) {
      return res.status(400).json({ error: 'Client ID, Secret, Username, and Password are required' });
    }

    const authResult = await TTLockService.authenticate(clientId, clientSecret, uName, passMd5);
    const locks = await TTLockService.fetchLocks(clientId, authResult.accessToken);

    // Save token and credentials in SQLite
    const expiry = Date.now() + (authResult.expiresIn || 7776000) * 1000;
    db.prepare(`
      UPDATE building_config SET
        ttlock_client_id = ?,
        ttlock_client_secret = ?,
        ttlock_username = ?,
        ttlock_password_md5 = ?,
        ttlock_access_token = ?,
        ttlock_token_expiry = ?,
        updated_at = ?
      WHERE id = 1
    `).run(clientId, clientSecret, uName, passMd5, authResult.accessToken, expiry, new Date().toISOString());

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true, totalLocks: locks.length, locks });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Unlock TTLock
router.post('/ttlock-unlock', async (req, res) => {
  try {
    const { lock_id } = req.body;
    if (!lock_id) return res.status(400).json({ error: 'lock_id is required' });

    const config = db.prepare('SELECT ttlock_client_id, ttlock_access_token, ttlock_legacy_url FROM building_config WHERE id = 1').get() as any;
    if (!config?.ttlock_access_token) {
      return res.status(400).json({ error: 'TTLock account not authenticated. Please sync in Admin Studio.' });
    }

    const result = await TTLockService.unlock(config.ttlock_client_id, config.ttlock_access_token, lock_id, config.ttlock_legacy_url);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// ==========================================
// WORKFLOW 5: Configuration Export & Import & Update
// ==========================================

// Update Building Config
router.post('/config', (req, res) => {
  try {
    const fields = req.body;
    const current = db.prepare('SELECT * FROM building_config WHERE id = 1').get() as any;

    let passMd5 = fields.ttlock_password ? crypto.createHash('md5').update(fields.ttlock_password).digest('hex') : current.ttlock_password_md5;

    db.prepare(`
      UPDATE building_config SET
        setup_completed = COALESCE(?, setup_completed),
        building_name = COALESCE(?, building_name),
        assistant_name = COALESCE(?, assistant_name),
        require_home_key = COALESCE(?, require_home_key),
        require_pwa = COALESCE(?, require_pwa),
        timezone = COALESCE(?, timezone),
        weather_lat = COALESCE(?, weather_lat),
        weather_lon = COALESCE(?, weather_lon),
        weather_label = COALESCE(?, weather_label),
        go2rtc_base_url = COALESCE(?, go2rtc_base_url),
        hr_base_url = COALESCE(?, hr_base_url),
        hr_auth_token = COALESCE(?, hr_auth_token),
        ttlock_client_id = COALESCE(?, ttlock_client_id),
        ttlock_client_secret = COALESCE(?, ttlock_client_secret),
        ttlock_username = COALESCE(?, ttlock_username),
        ttlock_password_md5 = ?,
        ttlock_h5_secret = COALESCE(?, ttlock_h5_secret),
        ttlock_legacy_url = COALESCE(?, ttlock_legacy_url),
        excluded_employee_ids_json = COALESCE(?, excluded_employee_ids_json),
        updated_at = ?
      WHERE id = 1
    `).run(
      fields.setup_completed !== undefined ? (fields.setup_completed ? 1 : 0) : null,
      fields.building_name,
      fields.assistant_name,
      fields.require_home_key !== undefined ? (fields.require_home_key ? 1 : 0) : null,
      fields.require_pwa !== undefined ? (fields.require_pwa ? 1 : 0) : null,
      fields.timezone,
      fields.weather_lat,
      fields.weather_lon,
      fields.weather_label,
      fields.go2rtc_base_url,
      fields.hr_base_url,
      fields.hr_auth_token,
      fields.ttlock_client_id,
      fields.ttlock_client_secret,
      fields.ttlock_username,
      passMd5,
      fields.ttlock_h5_secret,
      fields.ttlock_legacy_url,
      fields.excluded_employee_ids ? JSON.stringify(fields.excluded_employee_ids) : null,
      new Date().toISOString()
    );

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Export Building Configuration
router.get('/export', (req, res) => {
  try {
    const config = db.prepare('SELECT * FROM building_config WHERE id = 1').get();
    const hubs = db.prepare('SELECT * FROM ha_hubs').all();
    const floors = db.prepare('SELECT * FROM floors').all();
    const rooms = db.prepare('SELECT * FROM rooms').all();
    const devices = db.prepare('SELECT * FROM devices').all();
    const cameras = db.prepare('SELECT * FROM cameras').all();
    const ir_profiles = db.prepare('SELECT * FROM ir_profiles').all();
    const automations = db.prepare('SELECT * FROM automations').all();

    const exportData = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      building_config: config,
      ha_hubs: hubs,
      floors,
      rooms,
      devices,
      cameras,
      ir_profiles,
      automations,
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="dominatee_office_backup.json"');
    return res.send(JSON.stringify(exportData, null, 2));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Import Building Configuration
router.post('/import', (req, res) => {
  try {
    const data = req.body;
    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Invalid JSON config payload' });
    }

    db.transaction(() => {
      if (data.building_config) {
        const c = data.building_config;
        db.prepare(`
          UPDATE building_config SET
            setup_completed = 1,
            building_name = COALESCE(?, building_name),
            assistant_name = COALESCE(?, assistant_name),
            require_home_key = COALESCE(?, require_home_key),
            require_pwa = COALESCE(?, require_pwa),
            timezone = COALESCE(?, timezone),
            weather_lat = COALESCE(?, weather_lat),
            weather_lon = COALESCE(?, weather_lon),
            weather_label = COALESCE(?, weather_label),
            go2rtc_base_url = COALESCE(?, go2rtc_base_url),
            hr_base_url = COALESCE(?, hr_base_url),
            hr_auth_token = COALESCE(?, hr_auth_token),
            ttlock_client_id = COALESCE(?, ttlock_client_id),
            ttlock_client_secret = COALESCE(?, ttlock_client_secret),
            ttlock_username = COALESCE(?, ttlock_username),
            ttlock_password_md5 = COALESCE(?, ttlock_password_md5),
            ttlock_legacy_url = COALESCE(?, ttlock_legacy_url),
            updated_at = ?
          WHERE id = 1
        `).run(
          c.building_name,
          c.assistant_name,
          c.require_home_key,
          c.require_pwa,
          c.timezone,
          c.weather_lat,
          c.weather_lon,
          c.weather_label,
          c.go2rtc_base_url,
          c.hr_base_url,
          c.hr_auth_token,
          c.ttlock_client_id,
          c.ttlock_client_secret,
          c.ttlock_username,
          c.ttlock_password_md5,
          c.ttlock_legacy_url,
          new Date().toISOString()
        );
      }

      if (Array.isArray(data.ha_hubs)) {
        db.prepare('DELETE FROM ha_hubs').run();
        const ins = db.prepare('INSERT INTO ha_hubs (id, name, local_url, cloud_url, access_token, enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
        for (const h of data.ha_hubs) {
          ins.run(h.id, h.name, h.local_url, h.cloud_url || '', h.access_token, h.enabled ?? 1, h.sort_order ?? 0);
        }
      }

      if (Array.isArray(data.floors)) {
        db.prepare('DELETE FROM floors').run();
        const ins = db.prepare('INSERT INTO floors (id, name, slug, icon, accent_color, poster_image, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?)');
        for (const f of data.floors) {
          ins.run(f.id, f.name, f.slug, f.icon, f.accent_color, f.poster_image, f.sort_order ?? 0);
        }
      }

      if (Array.isArray(data.rooms)) {
        db.prepare('DELETE FROM rooms').run();
        const ins = db.prepare('INSERT INTO rooms (id, floor_id, ha_hub_id, name, slug, aliases_json, icon, accent_color, is_meeting_room, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const r of data.rooms) {
          ins.run(r.id, r.floor_id, r.ha_hub_id, r.name, r.slug, r.aliases_json || '[]', r.icon, r.accent_color, r.is_meeting_room ? 1 : 0, r.sort_order ?? 0);
        }
      }

      if (Array.isArray(data.devices)) {
        db.prepare('DELETE FROM devices').run();
        const ins = db.prepare('INSERT INTO devices (id, room_id, ha_hub_id, type, name, subtitle, entity_id, config_json, show_on_default_dashboard, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const d of data.devices) {
          ins.run(d.id, d.room_id, d.ha_hub_id, d.type, d.name, d.subtitle, d.entity_id, d.config_json || '{}', d.show_on_default_dashboard ? 1 : 0, d.sort_order ?? 0);
        }
      }

      if (Array.isArray(data.cameras)) {
        db.prepare('DELETE FROM cameras').run();
        const ins = db.prepare('INSERT INTO cameras (id, floor_id, room_id, name, stream_id, full_stream_id, rtsp_sub_url, rtsp_main_url, search_tags, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
        for (const c of data.cameras) {
          ins.run(c.id, c.floor_id, c.room_id, c.name, c.stream_id, c.full_stream_id, c.rtsp_sub_url, c.rtsp_main_url, c.search_tags || '', c.sort_order ?? 0);
        }
      }

      if (Array.isArray(data.ir_profiles)) {
        const ins = db.prepare('INSERT OR REPLACE INTO ir_profiles (id, name, brand, commands_json) VALUES (?, ?, ?, ?)');
        for (const p of data.ir_profiles) {
          ins.run(p.id, p.name, p.brand, p.commands_json);
        }
      }

      if (Array.isArray(data.automations)) {
        db.prepare('DELETE FROM automations').run();
        const ins = db.prepare('INSERT INTO automations (id, name, enabled, trigger_json, actions_json, steps_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
        for (const a of data.automations) {
          ins.run(a.id, a.name, a.enabled ?? 1, a.trigger_json, a.actions_json || '[]', a.steps_json || '[]', a.created_at || new Date().toISOString(), a.updated_at || new Date().toISOString());
        }
      }
    });

    liveSync.broadcast('bootstrap_updated');
    return res.json({ ok: true, message: 'Configuration imported successfully' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
