export interface BuildingConfig {
  id: number;
  setup_completed: number;
  building_name: string;
  assistant_name: string;
  home_key_hash?: string;
  home_key_preview?: string;
  require_home_key: number;
  require_pwa: number;
  timezone: string;
  weather_lat: number;
  weather_lon: number;
  weather_label: string;
  go2rtc_base_url?: string;
  go2rtc_config_path?: string;
  hr_base_url?: string;
  hr_auth_token?: string;
  ttlock_client_id?: string;
  ttlock_client_secret?: string;
  ttlock_username?: string;
  ttlock_password?: string;
  ttlock_h5_secret?: string;
  ttlock_legacy_url?: string;
  ttlock_authenticated?: boolean;
  mqtt_enabled?: number;
  mqtt_broker_url?: string;
  mqtt_username?: string;
  mqtt_password?: string;
  mqtt_base_topic?: string;
  tuya_enabled?: number;
  tuya_access_id?: string;
  tuya_region?: string;
  tuya_endpoint?: string;
  tuya_uid?: string;
  excluded_employee_ids_json?: string;
  quick_controls_json?: string;
  ui_theme?: UiTheme;
  updated_at?: string;
}

export type UiTheme = 'default' | 'crystal_glass' | 'glassmorphism_20';

export type QuickControlCategory = 'lights' | 'climate' | 'fans' | 'power' | 'curtains' | 'plugs' | 'custom';

export interface QuickControlConfig {
  id: string;
  category: QuickControlCategory;
  label: string;
  subtitle: string;
  icon: string;
  enabled: boolean;
  device_ids: string[]; // Empty array means auto-detect devices matching category
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      'video-rtc': any;
    }
  }
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: 'admin' | 'manager' | 'member' | 'kiosk';
  default_room_id?: string;
  theme_preference: string;
  favorites_json: string;
}

export interface HaHub {
  id: string;
  name: string;
  local_url: string;
  cloud_url?: string;
  access_token: string;
  enabled: number;
  sort_order: number;
}

export interface Floor {
  id: string;
  name: string;
  slug: string;
  icon: string;
  accent_color: string;
  poster_image?: string | null;
  sort_order: number;
}

export interface Room {
  id: string;
  floor_id: string;
  ha_hub_id?: string | null;
  name: string;
  slug: string;
  aliases_json: string;
  icon: string;
  accent_color: string;
  is_meeting_room: number;
  wallpaper_url?: string | null;
  sort_order: number;
}

export type DeviceType =
  | 'switch_light'
  | 'dimmable_light'
  | 'ac_ir'
  | 'climate'
  | 'blinds_relay'
  | 'cover'
  | 'presence_sensor'
  | 'exhaust_fan'
  | 'ttlock'
  | 'lock'
  | 'media_player'
  | 'environmental_sensor'
  | 'energy_meter'
  | 'smart_knob';

export interface Device {
  id: string;
  room_id: string;
  ha_hub_id?: string | null;
  type: DeviceType;
  name: string;
  subtitle?: string | null;
  entity_id?: string | null;
  z2m_friendly_name?: string | null;
  tuya_device_id?: string | null;
  tuya_local_key?: string | null;
  tuya_ip?: string | null;
  tuya_protocol_version?: string | null;
  config_json: string;
  show_on_default_dashboard: number;
  sort_order: number;
}

export interface Camera {
  id: string;
  floor_id?: string | null;
  room_id?: string | null;
  name: string;
  stream_id: string;
  full_stream_id?: string | null;
  rtsp_sub_url?: string | null;
  rtsp_main_url?: string | null;
  search_tags: string;
  sort_order: number;
  onvif_url?: string | null;
  onvif_user?: string | null;
  onvif_pass?: string | null;
  ptz_enabled?: number;
}

export interface IrProfile {
  id: string;
  name: string;
  brand?: string;
  commands_json: string;
}

export interface Automation {
  id: string;
  name: string;
  enabled: number;
  trigger_json: string;
  actions_json: string;
  steps_json: string;
  last_run_at?: string;
  last_checked_at?: string;
  last_triggered_key?: string;
  last_trigger_state_key?: string;
  last_error?: string;
  created_at: string;
  updated_at: string;
}

export interface PresetScene {
  id: string;
  name: string;
  desc: string;
  icon: string;
  accent_color?: string;
  actions_json: string;
  is_active?: number;
  sort_order?: number;
  updated_at?: string;
}

export interface HaEntityState {
  entity_id: string;
  state: string;
  attributes: Record<string, any>;
  last_changed?: string;
  last_updated?: string;
}

export interface Z2mExpose {
  type: string;
  name?: string;
  property?: string;
  access?: number;
  label?: string;
  description?: string;
  unit?: string;
  value_min?: number;
  value_max?: number;
  value_step?: number;
  values?: string[];
  presets?: Array<{ name: string; value: number | string; description?: string }>;
  features?: Z2mExpose[];
}

export interface Z2mDevice {
  ieee_address: string;
  friendly_name: string;
  type: string;
  supported: boolean;
  definition?: {
    model: string;
    vendor: string;
    description: string;
    exposes: Z2mExpose[];
    options?: any[];
  } | null;
  power_source?: string;
  linkquality?: number;
  disabled?: boolean;
  last_seen?: string;
  base_topic?: string;
  hub_id?: string;
  hub_name?: string;
}

export interface Z2mHub {
  id: string;
  name: string;
  broker_url: string;
  base_topic: string;
  username?: string;
  password?: string;
  enabled: boolean;
  sort_order?: number;
  connected?: boolean;
  bridgeState?: 'online' | 'offline' | 'unknown';
  devicesCount?: number;
  lastError?: string | null;
}

export interface Z2mStatus {
  enabled: boolean;
  connected: boolean;
  brokerUrl: string;
  baseTopic: string;
  devicesCount: number;
  bridgeState: 'online' | 'offline' | 'unknown';
  lastError: string | null;
  hubs?: Z2mHub[];
}

export interface TuyaDevice {
  id: string;
  name: string;
  category: string;
  product_name?: string;
  local_key?: string;
  ip?: string;
  online: boolean;
  is_local: boolean;
  protocol_version: string;
  status: Record<string, any>;
  dps: Record<string, any>;
}

export interface TuyaStatus {
  enabled: boolean;
  cloud_connected: boolean;
  region: string;
  endpoint: string;
  access_id: string;
  uid?: string;
  devices_count: number;
  local_online_count: number;
  last_sync: string | null;
  last_error: string | null;
}

export interface BootstrapData {
  config: BuildingConfig;
  hubs: HaHub[];
  floors: Floor[];
  rooms: Room[];
  devices: Device[];
  cameras: Camera[];
  ir_profiles: IrProfile[];
  automations: Automation[];
  presets?: PresetScene[];
  virtual_device_states: Record<string, any>;
  user_count: number;
  user: User | null;
  z2m_status?: Z2mStatus;
  z2m_devices?: Z2mDevice[];
  z2m_states?: Record<string, any>;
  tuya_status?: TuyaStatus;
  tuya_devices?: TuyaDevice[];
  tuya_states?: Record<string, any>;
}
