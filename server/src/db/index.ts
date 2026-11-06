import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.resolve(process.cwd(), 'building_os.db');

// Ensure parent directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) {
  fs.mkdirSync(dir, { recursive: true });
}

const rawDb = new DatabaseSync(DB_PATH);
rawDb.exec('PRAGMA journal_mode = WAL;');
rawDb.exec('PRAGMA foreign_keys = ON;');

export const db = {
  raw: rawDb,
  exec: (sql: string) => rawDb.exec(sql),
  prepare: (sql: string) => {
    const stmt = rawDb.prepare(sql);
    const clean = (params: any[]) => params.map((p) => (p === undefined ? null : p));
    return {
      run: (...params: any[]) => stmt.run(...clean(params)),
      get: (...params: any[]) => stmt.get(...clean(params)),
      all: (...params: any[]) => stmt.all(...clean(params)),
    };
  },
  transaction: <T>(fn: () => T): T => {
    rawDb.exec('BEGIN');
    try {
      const result = fn();
      rawDb.exec('COMMIT');
      return result;
    } catch (err) {
      rawDb.exec('ROLLBACK');
      throw err;
    }
  },
};

export function initDatabase() {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  let schema = '';
  if (fs.existsSync(schemaPath)) {
    schema = fs.readFileSync(schemaPath, 'utf8');
  } else {
    const fallbackPath = path.resolve(process.cwd(), 'src/db/schema.sql');
    if (fs.existsSync(fallbackPath)) {
      schema = fs.readFileSync(fallbackPath, 'utf8');
    }
  }

  if (schema) {
    db.exec(schema);
  }

  // Schema migrations for cameras table (ONVIF & PTZ columns)
  try {
    const cameraCols = (db.prepare('PRAGMA table_info(cameras)').all() as any[]).map((c) => c.name);
    if (!cameraCols.includes('onvif_url')) db.exec('ALTER TABLE cameras ADD COLUMN onvif_url TEXT;');
    if (!cameraCols.includes('onvif_user')) db.exec('ALTER TABLE cameras ADD COLUMN onvif_user TEXT;');
    if (!cameraCols.includes('onvif_pass')) db.exec('ALTER TABLE cameras ADD COLUMN onvif_pass TEXT;');
    if (!cameraCols.includes('ptz_enabled')) db.exec('ALTER TABLE cameras ADD COLUMN ptz_enabled INTEGER DEFAULT 1;');
  } catch (_) {}

  // Schema migrations for building_config (MQTT & Zigbee2MQTT columns)
  try {
    const configCols = (db.prepare('PRAGMA table_info(building_config)').all() as any[]).map((c) => c.name);
    if (!configCols.includes('mqtt_enabled')) db.exec('ALTER TABLE building_config ADD COLUMN mqtt_enabled INTEGER DEFAULT 0;');
    if (!configCols.includes('mqtt_broker_url')) db.exec("ALTER TABLE building_config ADD COLUMN mqtt_broker_url TEXT DEFAULT 'mqtt://127.0.0.1:1883';");
    if (!configCols.includes('mqtt_username')) db.exec("ALTER TABLE building_config ADD COLUMN mqtt_username TEXT DEFAULT '';");
    if (!configCols.includes('mqtt_password')) db.exec("ALTER TABLE building_config ADD COLUMN mqtt_password TEXT DEFAULT '';");
    if (!configCols.includes('mqtt_base_topic')) db.exec("ALTER TABLE building_config ADD COLUMN mqtt_base_topic TEXT DEFAULT 'zigbee2mqtt';");
  } catch (_) {}

  // Schema migrations for devices (Zigbee2MQTT direct topic column)
  try {
    const deviceCols = (db.prepare('PRAGMA table_info(devices)').all() as any[]).map((c) => c.name);
    if (!deviceCols.includes('z2m_friendly_name')) db.exec('ALTER TABLE devices ADD COLUMN z2m_friendly_name TEXT;');
    if (!deviceCols.includes('tuya_device_id')) db.exec('ALTER TABLE devices ADD COLUMN tuya_device_id TEXT;');
    if (!deviceCols.includes('tuya_local_key')) db.exec('ALTER TABLE devices ADD COLUMN tuya_local_key TEXT;');
    if (!deviceCols.includes('tuya_ip')) db.exec('ALTER TABLE devices ADD COLUMN tuya_ip TEXT;');
    if (!deviceCols.includes('tuya_protocol_version')) db.exec("ALTER TABLE devices ADD COLUMN tuya_protocol_version TEXT DEFAULT '3.3';");
  } catch (_) {}

  // Schema migrations for building_config (Tuya & Wi-Fi columns)
  try {
    const configCols = (db.prepare('PRAGMA table_info(building_config)').all() as any[]).map((c) => c.name);
    if (!configCols.includes('tuya_enabled')) db.exec('ALTER TABLE building_config ADD COLUMN tuya_enabled INTEGER DEFAULT 0;');
    if (!configCols.includes('tuya_access_id')) db.exec("ALTER TABLE building_config ADD COLUMN tuya_access_id TEXT DEFAULT '';");
    if (!configCols.includes('tuya_access_secret')) db.exec("ALTER TABLE building_config ADD COLUMN tuya_access_secret TEXT DEFAULT '';");
    if (!configCols.includes('tuya_region')) db.exec("ALTER TABLE building_config ADD COLUMN tuya_region TEXT DEFAULT 'in';");
    if (!configCols.includes('tuya_endpoint')) db.exec("ALTER TABLE building_config ADD COLUMN tuya_endpoint TEXT DEFAULT 'https://openapi.tuyain.com';");
    if (!configCols.includes('tuya_uid')) db.exec("ALTER TABLE building_config ADD COLUMN tuya_uid TEXT DEFAULT '';");
  } catch (_) {}

  // Schema table for multi-coordinator Zigbee2MQTT hubs (z2m_hubs)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS z2m_hubs (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        broker_url TEXT NOT NULL,
        base_topic TEXT DEFAULT 'zigbee2mqtt',
        username TEXT DEFAULT '',
        password TEXT DEFAULT '',
        enabled INTEGER DEFAULT 1,
        sort_order INTEGER DEFAULT 0
      );
    `);
    const hubCountRow = db.prepare('SELECT COUNT(*) as cnt FROM z2m_hubs').get() as { cnt: number };
    if (!hubCountRow || hubCountRow.cnt === 0) {
      const cfg = db.prepare('SELECT mqtt_enabled, mqtt_broker_url, mqtt_username, mqtt_password, mqtt_base_topic FROM building_config WHERE id = 1').get() as any;
      if (cfg && cfg.mqtt_broker_url) {
        db.prepare(`
          INSERT INTO z2m_hubs (id, name, broker_url, base_topic, username, password, enabled, sort_order)
          VALUES ('z2m_hub_1', 'Coordinator 1 (Primary)', ?, ?, ?, ?, ?, 0)
        `).run(
          cfg.mqtt_broker_url,
          cfg.mqtt_base_topic || 'zigbee2mqtt',
          cfg.mqtt_username || '',
          cfg.mqtt_password || '',
          cfg.mqtt_enabled ?? 1
        );
      }
    }
  } catch (_) {}

  // Ensure building_config row 1 exists in a fresh, unconfigured state (setup_completed = 0)
  const config = db.prepare('SELECT id, setup_completed FROM building_config WHERE id = 1').get() as { id: number; setup_completed: number } | undefined;
  if (!config) {
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO building_config (
        id, setup_completed, building_name, assistant_name,
        timezone, weather_lat, weather_lon, weather_label,
        go2rtc_base_url, go2rtc_config_path, updated_at
      ) VALUES (
        1, 0, 'Smart Office', 'DOMFLY',
        'Asia/Kolkata', 10.1906, 76.3879, 'Office HQ',
        '', './go2rtc.yaml', ?
      )
    `).run(now);
  }

  // Clean up any dummy pre-seeded IR profiles
  db.prepare("DELETE FROM ir_profiles WHERE id IN ('ir_daikin_default', 'ir_panasonic_default', 'ir_mitsubishi_default', 'ir_universal_default') OR id LIKE 'ir_%_default'").run();
}
