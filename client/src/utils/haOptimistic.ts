import type { HaEntityState } from '../types';

export function applyOptimisticUpdate(
  currentEntity: HaEntityState | undefined,
  domain: string,
  service: string,
  serviceData: Record<string, any>
): HaEntityState {
  if (!currentEntity) {
    return {
      entity_id: serviceData.entity_id || 'unknown',
      state: service === 'turn_on' ? 'on' : 'off',
      attributes: {},
    };
  }

  const updated: HaEntityState = {
    ...currentEntity,
    attributes: { ...currentEntity.attributes },
  };

  if (service === 'turn_on') {
    updated.state = 'on';
    if (serviceData.brightness !== undefined) {
      updated.attributes.brightness = serviceData.brightness;
    }
    if (serviceData.brightness_pct !== undefined) {
      updated.attributes.brightness = Math.round((serviceData.brightness_pct / 100) * 255);
    }
    if (serviceData.color_temp_kelvin !== undefined) {
      updated.attributes.color_temp_kelvin = serviceData.color_temp_kelvin;
    }
  } else if (service === 'turn_off') {
    updated.state = 'off';
  } else if (service === 'toggle') {
    updated.state = currentEntity.state === 'on' ? 'off' : 'on';
  } else if (service === 'set_temperature' && serviceData.temperature !== undefined) {
    updated.attributes.temperature = serviceData.temperature;
  } else if (service === 'set_hvac_mode' && serviceData.hvac_mode) {
    updated.state = serviceData.hvac_mode;
  }

  return updated;
}
