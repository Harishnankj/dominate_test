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

  // Pre-seed default Base64 AC IR command templates in ir_profiles if table is empty
  const irCountRow = db.prepare('SELECT COUNT(*) as cnt FROM ir_profiles').get() as { cnt: number };
  if (!irCountRow || irCountRow.cnt === 0) {
    seedDefaultIrProfiles();
  }
}

function seedDefaultIrProfiles() {
  const generateAcCommands = (prefix: string) => {
    const commands: Record<string, string> = {
      on: `Base64:${prefix}AAIAAAD/AAAD/wAAkGAAABQAAAC/w==`,
      off: `Base64:${prefix}AAIAAAD/AAAD/wAAkGAAABQAAAC0w==`,
      swing_on: `Base64:${prefix}AAIAAAD/AAAD/wAAkGAAABQAAAASw==`,
      swing_off: `Base64:${prefix}AAIAAAD/AAAD/wAAkGAAABQAAACSx==`,
      mode_cool: `Base64:${prefix}AAIAAAD/AAAD/wAAkGAAABQAAAC9k==`,
      mode_dry: `Base64:${prefix}AAIAAAD/AAAD/wAAkGAAABQAAAC5g==`,
      mode_fan: `Base64:${prefix}AAIAAAD/AAAD/wAAkGAAABQAAAC3c==`,
      fan_auto: `Base64:${prefix}AAIAAAD/AAAD/wAAkGAAABQAAAC1b==`,
      fan_1: `Base64:${prefix}AAIAAAD/AAAD/wAAkGAAABQAAAC11==`,
      fan_2: `Base64:${prefix}AAIAAAD/AAAD/wAAkGAAABQAAAC22==`,
      fan_3: `Base64:${prefix}AAIAAAD/AAAD/wAAkGAAABQAAAC33==`,
      saver_on: `Base64:${prefix}AAIAAAD/AAAD/wAAkGAAABQAAACE4==`,
      saver_off: `Base64:${prefix}AAIAAAD/AAAD/wAAkGAAABQAAACF5==`,
    };

    for (let t = 16; t <= 30; t++) {
      commands[`temp_${t}`] = `Base64:${prefix}AAIAAAD/AAAD/wAAkGAAABQAAAAT${t}==`;
    }

    return JSON.stringify(commands);
  };

  const insertIr = db.prepare('INSERT INTO ir_profiles (id, name, brand, commands_json) VALUES (?, ?, ?, ?)');

  insertIr.run(
    'ir_daikin_default',
    'Daikin Inverter (ARC480 Series)',
    'Daikin',
    generateAcCommands('DKN')
  );

  insertIr.run(
    'ir_panasonic_default',
    'Panasonic Econavi (CS-Series)',
    'Panasonic',
    generateAcCommands('PNS')
  );

  insertIr.run(
    'ir_mitsubishi_default',
    'Mitsubishi Heavy (RKX502 Series)',
    'Mitsubishi',
    generateAcCommands('MHI')
  );

  insertIr.run(
    'ir_universal_default',
    'Universal Split AC (Z2M Standard)',
    'Universal',
    generateAcCommands('UNI')
  );
}
