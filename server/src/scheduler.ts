import cron from 'node-cron';
import { db } from './db/index.js';
import { HaService } from './services/haService.js';
import { TTLockService } from './services/ttlockService.js';
import { liveSync } from './websocket/liveSync.js';
import { mqttService } from './services/mqttService.js';

interface AutomationRow {
  id: string;
  name: string;
  enabled: number;
  trigger_json: string;
  actions_json: string;
  steps_json: string;
  last_run_at?: string;
  last_checked_at?: string;
  last_triggered_key?: string;
}

interface DeviceRow {
  id: string;
  room_id: string;
  ha_hub_id?: string;
  type: string;
  name: string;
  entity_id: string;
  config_json: string;
}

interface HubRow {
  id: string;
  name: string;
  local_url: string;
  cloud_url: string;
  access_token: string;
  enabled: number;
}

export class AutomationScheduler {
  private cronJob: cron.ScheduledTask | null = null;

  public start() {
    // Run every minute at second 0
    this.cronJob = cron.schedule('* * * * *', async () => {
      try {
        await this.evaluateAutomations();
      } catch (err) {
        console.error('[Scheduler] Error evaluating automations:', err);
      }
    });
    console.log('[Scheduler] In-process 1-minute automation scheduler initialized');
  }

  public stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
  }

  public async evaluateAutomations() {
    const automations = db.prepare('SELECT * FROM automations WHERE enabled = 1').all() as unknown as AutomationRow[];
    const now = new Date();
    const currentHour = String(now.getHours()).padStart(2, '0');
    const currentMinute = String(now.getMinutes()).padStart(2, '0');
    const currentTimeStr = `${currentHour}:${currentMinute}`;
    const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday

    for (const auto of automations) {
      try {
        let trigger: any = {};
        try {
          trigger = JSON.parse(auto.trigger_json);
        } catch (_) {}

        let shouldRun = false;

        if (trigger.type === 'time') {
          // Trigger matches HH:MM and optional days array
          if (trigger.time === currentTimeStr) {
            if (!trigger.days || trigger.days.includes(currentDay)) {
              // Ensure we only run once per this minute
              const todayMinuteKey = `${now.toISOString().slice(0, 10)}_${currentTimeStr}`;
              if (auto.last_triggered_key !== todayMinuteKey) {
                shouldRun = true;
                db.prepare('UPDATE automations SET last_triggered_key = ? WHERE id = ?').run(todayMinuteKey, auto.id);
              }
            }
          }
        }

        if (shouldRun) {
          console.log(`[Scheduler] Triggering scheduled automation: "${auto.name}" (${auto.id})`);
          await this.executeAutomation(auto.id);
        }

        db.prepare('UPDATE automations SET last_checked_at = ? WHERE id = ?').run(now.toISOString(), auto.id);
      } catch (err: any) {
        console.error(`[Scheduler] Automation ${auto.id} evaluation failed:`, err);
        db.prepare('UPDATE automations SET last_error = ? WHERE id = ?').run(err.message, auto.id);
      }
    }
  }

  public async executeAutomation(automationId: string): Promise<{ success: boolean; executedSteps: number }> {
    const auto = db.prepare('SELECT * FROM automations WHERE id = ?').get(automationId) as AutomationRow | undefined;
    if (!auto) {
      throw new Error(`Automation ${automationId} not found`);
    }

    let steps: any[] = [];
    try {
      steps = JSON.parse(auto.steps_json || auto.actions_json || '[]');
    } catch (_) {}

    let executedCount = 0;
    const nowIso = new Date().toISOString();

    for (const step of steps) {
      try {
        await this.executeStep(step);
        executedCount++;
      } catch (err) {
        console.warn(`[Scheduler] Failed step in automation ${automationId}:`, err);
      }
    }

    db.prepare('UPDATE automations SET last_run_at = ?, last_error = NULL WHERE id = ?').run(nowIso, automationId);
    liveSync.broadcast('automation_executed', { id: automationId, name: auto.name });

    return { success: true, executedSteps: executedCount };
  }

  public async executeStep(step: { device_id: string; action: string; value?: any; delay_ms?: number }) {
    if (!step.device_id) return;

    if (step.delay_ms && step.delay_ms > 0) {
      await new Promise((res) => setTimeout(res, step.delay_ms));
    }

    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(step.device_id) as DeviceRow | undefined;
    if (!device) {
      console.warn(`[Scheduler] Device ${step.device_id} not found in database`);
      return;
    }

    // TTLock handling
    if (device.type === 'ttlock') {
      const config = db.prepare('SELECT ttlock_client_id, ttlock_access_token, ttlock_legacy_url FROM building_config WHERE id = 1').get() as any;
      let devConfig: any = {};
      try { devConfig = JSON.parse(device.config_json); } catch (_) {}
      const lockId = devConfig.lockId || device.entity_id;
      if (lockId && config?.ttlock_access_token) {
        await TTLockService.unlock(config.ttlock_client_id, config.ttlock_access_token, lockId, config.ttlock_legacy_url);
      }
      return;
    }

    // Direct Zigbee2MQTT execution check
    let devConfig: any = {};
    try { devConfig = JSON.parse(device.config_json); } catch (_) {}
    const z2mName = (device as any).z2m_friendly_name || devConfig.z2m_friendly_name;

    if (z2mName && (mqttService.getStatus().connected || !device.entity_id)) {
      try {
        const payload: Record<string, any> = {};
        if (step.action === 'turn_off') {
          payload.state = 'OFF';
        } else if (step.action === 'turn_on') {
          payload.state = 'ON';
          if (step.value?.brightness !== undefined) {
            payload.brightness = Math.round((step.value.brightness / 100) * 254);
          }
        } else if (step.action === 'toggle') {
          payload.state = 'TOGGLE';
        } else if (step.action === 'open') {
          payload.state = 'OPEN';
        } else if (step.action === 'close') {
          payload.state = 'CLOSE';
        } else if (step.action === 'stop') {
          payload.state = 'STOP';
        }

        await mqttService.setDeviceState(z2mName, payload);
        return;
      } catch (err: any) {
        console.warn(`[Scheduler] Direct Z2M execution failed for ${z2mName}:`, err.message);
        // Continue to HA if entity_id exists
      }
    }

    // Home Assistant device handling
    // Resolve Hub
    let hubId = device.ha_hub_id;
    if (!hubId) {
      const room = db.prepare('SELECT ha_hub_id FROM rooms WHERE id = ?').get(device.room_id) as { ha_hub_id?: string } | undefined;
      hubId = room?.ha_hub_id;
    }

    let hub: HubRow | undefined;
    if (hubId) {
      hub = db.prepare('SELECT * FROM ha_hubs WHERE id = ?').get(hubId) as HubRow | undefined;
    }
    if (!hub) {
      hub = db.prepare('SELECT * FROM ha_hubs WHERE enabled = 1 LIMIT 1').get() as HubRow | undefined;
    }

    if (!hub || !hub.local_url || !hub.access_token) {
      console.warn(`[Scheduler] No valid Home Assistant hub found for device ${device.name}`);
      return;
    }

    const entityId = device.entity_id;
    if (!entityId) return;

    const domain = entityId.split('.')[0];

    switch (device.type) {
      case 'switch_light':
      case 'exhaust_fan': {
        const srv = step.action === 'turn_off' ? 'turn_off' : 'turn_on';
        await HaService.callService(hub.local_url, hub.access_token, domain, srv, { entity_id: entityId });
        break;
      }

      case 'dimmable_light': {
        if (step.action === 'turn_off') {
          await HaService.callService(hub.local_url, hub.access_token, 'light', 'turn_off', { entity_id: entityId });
        } else {
          const serviceData: any = { entity_id: entityId };
          if (step.value?.brightness !== undefined) {
            serviceData.brightness_pct = step.value.brightness;
          }
          if (step.value?.color_temp !== undefined) {
            serviceData.color_temp_kelvin = step.value.color_temp;
          }
          await HaService.callService(hub.local_url, hub.access_token, 'light', 'turn_on', serviceData);
        }
        break;
      }

      case 'ac_ir': {
        let devConfig: any = {};
        try { devConfig = JSON.parse(device.config_json); } catch (_) {}
        const irProfileId = devConfig.ir_profile_id;
        const profile = irProfileId ? db.prepare('SELECT commands_json FROM ir_profiles WHERE id = ?').get(irProfileId) as any : null;
        let commands: Record<string, string> = {};
        if (profile) {
          try { commands = JSON.parse(profile.commands_json); } catch (_) {}
        }

        const cmdKey = step.action === 'turn_off' ? 'off' : (step.value?.command || 'on');
        const irCode = commands[cmdKey];
        if (irCode) {
          // Send to IR text entity
          await HaService.callService(hub.local_url, hub.access_token, 'text', 'set_value', {
            entity_id: entityId,
            value: irCode,
          });

          // Save virtual state
          const newState = {
            power: step.action !== 'turn_off',
            temp: step.value?.temp || 24,
            mode: step.value?.mode || 'cool',
            fan: step.value?.fan || 'auto',
          };
          db.prepare(`
            INSERT INTO virtual_device_states (device_id, state_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(device_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at
          `).run(device.id, JSON.stringify(newState), Date.now());

          liveSync.broadcast('virtual_state_updated', { deviceId: device.id, state: newState });
        }
        break;
      }

      case 'climate': {
        if (step.action === 'turn_off') {
          await HaService.callService(hub.local_url, hub.access_token, 'climate', 'set_hvac_mode', {
            entity_id: entityId,
            hvac_mode: 'off',
          });
        } else {
          if (step.value?.temperature) {
            await HaService.callService(hub.local_url, hub.access_token, 'climate', 'set_temperature', {
              entity_id: entityId,
              temperature: step.value.temperature,
            });
          }
          if (step.value?.hvac_mode) {
            await HaService.callService(hub.local_url, hub.access_token, 'climate', 'set_hvac_mode', {
              entity_id: entityId,
              hvac_mode: step.value.hvac_mode,
            });
          }
        }
        break;
      }

      case 'blinds_relay': {
        let devConfig: any = {};
        try { devConfig = JSON.parse(device.config_json); } catch (_) {}
        const upEntity = devConfig.up_entity_id;
        const downEntity = devConfig.down_entity_id;
        const travelMs = devConfig.travel_ms || 20000;

        if (step.action === 'open' && upEntity) {
          await HaService.callService(hub.local_url, hub.access_token, 'switch', 'turn_on', { entity_id: upEntity });
          setTimeout(() => {
            HaService.callService(hub.local_url, hub.access_token, 'switch', 'turn_off', { entity_id: upEntity }).catch(() => {});
          }, travelMs);
        } else if (step.action === 'close' && downEntity) {
          await HaService.callService(hub.local_url, hub.access_token, 'switch', 'turn_on', { entity_id: downEntity });
          setTimeout(() => {
            HaService.callService(hub.local_url, hub.access_token, 'switch', 'turn_off', { entity_id: downEntity }).catch(() => {});
          }, travelMs);
        } else if (step.action === 'stop') {
          if (upEntity) await HaService.callService(hub.local_url, hub.access_token, 'switch', 'turn_off', { entity_id: upEntity });
          if (downEntity) await HaService.callService(hub.local_url, hub.access_token, 'switch', 'turn_off', { entity_id: downEntity });
        }
        break;
      }

      case 'cover': {
        const srv = step.action === 'close' ? 'close_cover' : step.action === 'stop' ? 'stop_cover' : 'open_cover';
        await HaService.callService(hub.local_url, hub.access_token, 'cover', srv, { entity_id: entityId });
        break;
      }

      default:
        console.log(`[Scheduler] Unknown action or type for device ${device.id}`);
    }
  }
}

export const automationScheduler = new AutomationScheduler();
