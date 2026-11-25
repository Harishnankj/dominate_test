import type { Device, HaEntityState, QuickControlCategory, QuickControlConfig } from '../types';

export type DeviceRoleCategory = 'light' | 'ac' | 'fan' | 'plug' | 'curtain' | 'lock' | 'sensor' | 'meter';

export const DEFAULT_QUICK_CONTROLS: QuickControlConfig[] = [
  {
    id: 'qc_lights',
    category: 'lights',
    label: 'All Lights',
    subtitle: 'Building lighting',
    icon: 'Lightbulb',
    enabled: true,
    device_ids: [],
  },
  {
    id: 'qc_climate',
    category: 'climate',
    label: 'AC Climate',
    subtitle: 'Cooling & HVAC',
    icon: 'Thermometer',
    enabled: true,
    device_ids: [],
  },
  {
    id: 'qc_fans',
    category: 'fans',
    label: 'Fans & Vents',
    subtitle: 'Air circulation',
    icon: 'Fan',
    enabled: true,
    device_ids: [],
  },
  {
    id: 'qc_power',
    category: 'power',
    label: 'Main Power',
    subtitle: 'Live building load',
    icon: 'Power',
    enabled: true,
    device_ids: [],
  },
  {
    id: 'qc_curtains',
    category: 'curtains',
    label: 'Curtains',
    subtitle: 'Blinds & shades',
    icon: 'Wind',
    enabled: true,
    device_ids: [],
  },
  {
    id: 'qc_plugs',
    category: 'plugs',
    label: 'Smart Plugs',
    subtitle: 'Relays & outlets',
    icon: 'Plug',
    enabled: true,
    device_ids: [],
  },
];

export function parseQuickControls(rawJson?: string | null): QuickControlConfig[] {
  if (!rawJson || !rawJson.trim()) return DEFAULT_QUICK_CONTROLS;
  try {
    const parsed = JSON.parse(rawJson);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (_) {}
  return DEFAULT_QUICK_CONTROLS;
}

/**
 * Resolves the functional role/category of a mapped device.
 * Checks explicit config_json.category first, then device.type, then intelligent naming hints
 * (e.g. AC_Whirlpool mapped as a switch breaker -> 'ac', fan switch -> 'fan').
 */
export function getDeviceRoleCategory(dev: Device): DeviceRoleCategory {
  let config: Record<string, any> = {};
  try {
    config = JSON.parse(dev.config_json || '{}');
  } catch (_) {}

  const explicit = String(config.category || '').toLowerCase();
  if (explicit === 'socket' || explicit === 'plug') return 'plug';
  if (explicit === 'ac' || explicit === 'climate') return 'ac';
  if (explicit === 'fan') return 'fan';
  if (explicit === 'light') return 'light';
  if (explicit === 'curtain' || explicit === 'cover') return 'curtain';
  if (explicit === 'lock') return 'lock';
  if (explicit === 'sensor') return 'sensor';
  if (explicit === 'meter') return 'meter';

  if (dev.type === 'ac_ir' || dev.type === 'climate') return 'ac';
  if (dev.type === 'exhaust_fan') return 'fan';
  if (dev.type === 'dimmable_light') return 'light';
  if (dev.type === 'blinds_relay' || dev.type === 'cover') return 'curtain';
  if (dev.type === 'ttlock' || dev.type === 'lock') return 'lock';
  if (dev.type === 'presence_sensor' || dev.type === 'environmental_sensor' || dev.type === 'smart_knob') return 'sensor';
  if (dev.type === 'energy_meter') return 'meter';

  // Catch-all switch_light: inspect name & subtitle & entity_id
  const nameAndSub = `${dev.name || ''} ${dev.subtitle || ''}`.toLowerCase();
  if (
    /\bac\b|whirlpool|air[\s_-]*con|hvac|daikin|voltas|bluestar|hitachi|carrier|lloyd|o[\s_-]*general|split|^ac[\s_-]|_ac$/i.test(
      dev.name || ''
    )
  ) {
    return 'ac';
  }
  if (/\bfan\b|exhaust|ventilation|\bvent\b/i.test(nameAndSub)) {
    return 'fan';
  }
  if (/(vibration|occupancy|motion|presence)/i.test(nameAndSub)) {
    return 'sensor';
  }
  if (/(energy[\s_-]*meter|circuit[\s_-]*breaker|\bmcb\b)/i.test(nameAndSub)) {
    return 'meter';
  }
  if (/(plug|socket|outlet)/i.test(nameAndSub)) {
    return 'plug';
  }

  return 'light';
}

export function getDevicesForQuickControl(qc: QuickControlConfig, allDevices: Device[]): Device[] {
  if (Array.isArray(qc.device_ids) && qc.device_ids.length > 0) {
    const idSet = new Set(qc.device_ids);
    return allDevices.filter((d) => idSet.has(d.id));
  }

  // Auto-match by category
  const cat: QuickControlCategory = qc.category;
  return allDevices.filter((dev) => {
    const role = getDeviceRoleCategory(dev);
    if (cat === 'lights') return role === 'light';
    if (cat === 'climate') return role === 'ac';
    if (cat === 'fans') return role === 'fan';
    if (cat === 'curtains') return role === 'curtain';
    if (cat === 'plugs') return role === 'plug' || role === 'meter';
    if (cat === 'power') return role === 'meter' || role === 'ac' || role === 'plug';
    return false;
  });
}

export interface LiveDeviceStateHelpers {
  getEntity: (entityId: string, hubId?: string | null) => HaEntityState | undefined;
  z2mStates: Record<string, any>;
  tuyaStates: Record<string, any>;
  virtualStates?: Record<string, any>;
}

/**
 * Resolves live ON/OFF status and metered power (W) across HA, Zigbee2MQTT, Tuya, and Virtual state.
 */
export function resolveLiveDeviceStatus(
  dev: Device,
  helpers: LiveDeviceStateHelpers
): { isOn: boolean; powerW: number | null; rawState: string } {
  let config: Record<string, any> = {};
  try {
    config = JSON.parse(dev.config_json || '{}');
  } catch (_) {}

  const z2mKey = dev.z2m_friendly_name || config.z2m_friendly_name;
  const tuyaId = dev.tuya_device_id || config.tuya_device_id;

  const haEnt = dev.entity_id ? helpers.getEntity(dev.entity_id, dev.ha_hub_id) : undefined;
  const haState = haEnt?.state ? String(haEnt.state).toLowerCase() : 'unavailable';
  const zState = z2mKey ? helpers.z2mStates[z2mKey] : undefined;
  const tState = tuyaId ? helpers.tuyaStates[tuyaId] : undefined;
  const vState = helpers.virtualStates?.[dev.id];

  // Resolve metered power (W)
  const powerW: number | null =
    (typeof zState?.power_a === 'number' ? zState.power_a : null) ??
    (typeof zState?.power === 'number' ? zState.power : null) ??
    (typeof tState?.cur_power === 'number' ? tState.cur_power / 10 : null) ??
    (typeof haEnt?.attributes?.power === 'number' ? haEnt.attributes.power : null) ??
    (typeof haEnt?.attributes?.current_power_w === 'number' ? haEnt.attributes.current_power_w : null);

  // Resolve active state across protocols
  let isOn = false;
  let rawState = 'off';

  if (haState !== 'unavailable' && haState !== 'unknown' && dev.entity_id) {
    rawState = haState;
    isOn = ['on', 'cool', 'heat', 'auto', 'dry', 'fan_only', 'heat_cool', 'open'].includes(haState);
  } else if (zState) {
    const ep =
      config.endpoint ||
      (dev.name.match(/(?:switch|gang|button|light|ch|channel|relay)\s*(\d+)/i)
        ? `l${dev.name.match(/(?:switch|gang|button|light|ch|channel|relay)\s*(\d+)/i)?.[1]}`
        : undefined);
    if (ep && zState[`state_${ep}`] !== undefined) {
      rawState = String(zState[`state_${ep}`]).toLowerCase();
      isOn = rawState === 'on';
    } else if (ep && zState[ep] !== undefined) {
      rawState = String(zState[ep]).toLowerCase();
      isOn = rawState === 'on';
    } else if (zState.state !== undefined) {
      rawState = String(zState.state).toLowerCase();
      isOn = rawState === 'on';
    } else {
      const gangStates = Object.keys(zState)
        .filter((k) => k.startsWith('state_') && typeof zState[k] === 'string')
        .map((k) => String(zState[k]).toLowerCase());
      if (gangStates.length > 0) {
        isOn = gangStates.includes('on');
        rawState = isOn ? 'on' : 'off';
      }
    }
  } else if (tState) {
    if (tState.switch_1 !== undefined) {
      isOn = Boolean(tState.switch_1);
      rawState = isOn ? 'on' : 'off';
    } else if (tState.switch_led !== undefined) {
      isOn = Boolean(tState.switch_led);
      rawState = isOn ? 'on' : 'off';
    } else if (tState.state !== undefined) {
      rawState = String(tState.state).toLowerCase();
      isOn = rawState === 'on';
    }
  } else if (vState) {
    if (vState.power !== undefined) {
      isOn = Boolean(vState.power);
      rawState = isOn ? 'on' : 'off';
    } else if (vState.position !== undefined) {
      isOn = Number(vState.position) > 0;
      rawState = isOn ? 'open' : 'closed';
    }
  }

  return { isOn, powerW, rawState };
}

export interface ActuateHelpers {
  callService: (domain: string, service: string, serviceData?: Record<string, any>) => Promise<any>;
  setZ2mState: (friendlyName: string, state: Record<string, any>) => Promise<boolean>;
  setTuyaState: (deviceId: string, state: Record<string, any>) => Promise<boolean>;
  sendAcIrCommand: (deviceId: string, commandKey: string, stateSnapshot?: any) => Promise<any>;
  moveRelayBlinds: (deviceId: string, action: 'open' | 'close' | 'stop') => Promise<any>;
}

/**
 * Turns a single device ON or OFF regardless of protocol (HA, Z2M, Tuya, IR, Relay Blinds).
 */
export async function actuateSingleDevice(dev: Device, turnOn: boolean, helpers: ActuateHelpers): Promise<void> {
  let cfg: Record<string, any> = {};
  try {
    cfg = JSON.parse(dev.config_json || '{}');
  } catch (_) {}

  const zName = dev.z2m_friendly_name || cfg.z2m_friendly_name;
  const tuyaId = dev.tuya_device_id || cfg.tuya_device_id;
  const ep =
    cfg.endpoint ||
    (dev.name.match(/(?:switch|gang|button|light|ch|channel|relay)\s*(\d+)/i)
      ? `l${dev.name.match(/(?:switch|gang|button|light|ch|channel|relay)\s*(\d+)/i)?.[1]}`
      : undefined);

  if (dev.type === 'ac_ir') {
    await helpers
      .sendAcIrCommand(dev.id, turnOn ? 'on' : 'off', {
        power: turnOn,
        temp: 24,
        mode: 'cool',
        fan: 'auto',
      })
      .catch(() => {});
    return;
  }

  if (dev.type === 'climate' && dev.entity_id) {
    await helpers
      .callService('climate', turnOn ? 'set_hvac_mode' : 'turn_off', {
        entity_id: dev.entity_id,
        hvac_mode: turnOn ? 'cool' : 'off',
      })
      .catch(() => {});
    return;
  }

  if (dev.type === 'blinds_relay') {
    await helpers.moveRelayBlinds(dev.id, turnOn ? 'open' : 'close').catch(() => {});
    return;
  }

  if (dev.type === 'cover' && dev.entity_id) {
    await helpers
      .callService('cover', turnOn ? 'open_cover' : 'close_cover', {
        entity_id: dev.entity_id,
      })
      .catch(() => {});
    return;
  }

  if (zName) {
    if (ep) {
      await helpers.setZ2mState(zName, { [`state_${ep}`]: turnOn ? 'ON' : 'OFF' }).catch(() => {});
    } else {
      await helpers.setZ2mState(zName, { state: turnOn ? 'ON' : 'OFF' }).catch(() => {});
    }
  }
  if (tuyaId) {
    const payload = dev.type === 'dimmable_light' ? { switch_led: turnOn } : { switch_1: turnOn, state: turnOn ? 'ON' : 'OFF' };
    await helpers.setTuyaState(tuyaId, payload).catch(() => {});
  }
  if (dev.entity_id) {
    const domain = dev.entity_id.split('.')[0] || 'switch';
    await helpers
      .callService(domain, turnOn ? 'turn_on' : 'turn_off', { entity_id: dev.entity_id })
      .catch(() => {});
  }
}

