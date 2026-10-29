-- Building OS SQLite Database Schema
-- 100% Dynamic, User-Configurable, Local-First Architecture

CREATE TABLE IF NOT EXISTS building_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  setup_completed INTEGER DEFAULT 0,
  building_name TEXT DEFAULT 'Smart Office',
  assistant_name TEXT DEFAULT 'DOMFLY',
  home_key_hash TEXT,
  home_key_preview TEXT,
  require_home_key INTEGER DEFAULT 0,
  require_pwa INTEGER DEFAULT 0,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  weather_lat REAL DEFAULT 10.1906,
  weather_lon REAL DEFAULT 76.3879,
  weather_label TEXT DEFAULT 'Office',
  go2rtc_base_url TEXT DEFAULT '',
  go2rtc_config_path TEXT DEFAULT './go2rtc.yaml',
  hr_base_url TEXT DEFAULT '',
  hr_auth_token TEXT DEFAULT '',
  ttlock_client_id TEXT DEFAULT '',
  ttlock_client_secret TEXT DEFAULT '',
  ttlock_username TEXT DEFAULT '',
  ttlock_password_md5 TEXT DEFAULT '',
  ttlock_h5_secret TEXT DEFAULT '',
  ttlock_legacy_url TEXT DEFAULT '',
  ttlock_access_token TEXT DEFAULT '',
  ttlock_token_expiry INTEGER DEFAULT 0,
  mqtt_enabled INTEGER DEFAULT 0,
  mqtt_broker_url TEXT DEFAULT 'mqtt://127.0.0.1:1883',
  mqtt_username TEXT DEFAULT '',
  mqtt_password TEXT DEFAULT '',
  mqtt_base_topic TEXT DEFAULT 'zigbee2mqtt',
  excluded_employee_ids_json TEXT DEFAULT '[]',
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'member', -- admin, manager, member, kiosk
  default_room_id TEXT,
  theme_preference TEXT DEFAULT 'dark',
  favorites_json TEXT DEFAULT '[]',
  created_at TEXT,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS ha_hubs (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  local_url TEXT NOT NULL,
  cloud_url TEXT DEFAULT '',
  access_token TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS floors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT DEFAULT 'Building2',
  accent_color TEXT DEFAULT 'primary-400',
  poster_image TEXT,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  floor_id TEXT NOT NULL REFERENCES floors(id) ON DELETE CASCADE,
  ha_hub_id TEXT REFERENCES ha_hubs(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  aliases_json TEXT DEFAULT '[]',
  icon TEXT DEFAULT 'Briefcase',
  accent_color TEXT DEFAULT 'primary-400',
  is_meeting_room INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ir_profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT,
  commands_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  ha_hub_id TEXT REFERENCES ha_hubs(id) ON DELETE SET NULL,
  type TEXT NOT NULL, -- switch_light, dimmable_light, ac_ir, climate, blinds_relay, cover, presence_sensor, exhaust_fan, ttlock, media_player
  name TEXT NOT NULL,
  subtitle TEXT,
  entity_id TEXT,
  config_json TEXT DEFAULT '{}',
  show_on_default_dashboard INTEGER DEFAULT 0,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cameras (
  id TEXT PRIMARY KEY,
  floor_id TEXT REFERENCES floors(id) ON DELETE SET NULL,
  room_id TEXT REFERENCES rooms(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  stream_id TEXT NOT NULL,
  full_stream_id TEXT,
  rtsp_sub_url TEXT,
  rtsp_main_url TEXT,
  search_tags TEXT DEFAULT '',
  sort_order INTEGER DEFAULT 0,
  onvif_url TEXT,
  onvif_user TEXT,
  onvif_pass TEXT,
  ptz_enabled INTEGER DEFAULT 1
);

CREATE TABLE IF NOT EXISTS automations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  trigger_json TEXT NOT NULL,
  actions_json TEXT NOT NULL,
  steps_json TEXT NOT NULL,
  last_run_at TEXT,
  last_checked_at TEXT,
  last_triggered_key TEXT,
  last_trigger_state_key TEXT,
  last_error TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS virtual_device_states (
  device_id TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Indexing for fast lookups
CREATE INDEX IF NOT EXISTS idx_rooms_floor ON rooms(floor_id);
CREATE INDEX IF NOT EXISTS idx_devices_room ON devices(room_id);
CREATE INDEX IF NOT EXISTS idx_cameras_floor ON cameras(floor_id);
