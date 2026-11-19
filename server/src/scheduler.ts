import cron from 'node-cron';
import { db } from './db/index.js';
import { HaService } from './services/haService.js';
import { TTLockService } from './services/ttlockService.js';
import { liveSync } from './websocket/liveSync.js';
import { mqttService } from './services/mqttService.js';
import { tuyaService } from './services/tuyaService.js';

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
  last_trigger_state_key?: string;
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
  private intervalTimer: NodeJS.Timeout | null = null;
  private isEvaluating = false;

  public start() {
    // 1. Cron for scheduled minute-based clock automations
    this.cronJob = cron.schedule('* * * * *', async () => {
      await this.runSafeEvaluation();
    });

    // 2. High-frequency 15-second loop for responsive cyclic auto-cutoff routines & state tracking
    this.intervalTimer = setInterval(async () => {
      await this.runSafeEvaluation();
    }, 15000);

    console.log('[Scheduler] In-process automation scheduler initialized (1-min clock cron + 15s duty-cycle monitor)');
  }

  private async runSafeEvaluation() {
    if (this.isEvaluating) return;
    this.isEvaluating = true;
    try {
      await this.evaluateAutomations();
    } catch (err) {
      console.error('[Scheduler] Error evaluating automations:', err);
    } finally {
      this.isEvaluating = false;
    }
  }

  public stop() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
    }
    if (this.intervalTimer) {
      clearInterval(this.intervalTimer);
      this.intervalTimer = null;
    }
  }

  public async isDeviceOn(deviceId: string): Promise<boolean> {
    try {
      const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(deviceId) as DeviceRow | undefined;
      if (!device) return false;

      let devConfig: any = {};
      try { devConfig = JSON.parse(device.config_json); } catch (_) {}

      // 1. Check AC IR virtual state
      if (device.type === 'ac_ir') {
        const vState = db.prepare('SELECT state_json FROM virtual_device_states WHERE device_id = ?').get(deviceId) as any;
        if (vState) {
          try {
            const s = JSON.parse(vState.state_json);
            return Boolean(s.power);
          } catch (_) {}
        }
      }

      // 2. Check Home Assistant Entity State (HTTP REST query to HA Hub)
      if (device.entity_id) {
        let hubId = device.ha_hub_id;
        if (!hubId) {
          const room = db.prepare('SELECT ha_hub_id FROM rooms WHERE id = ?').get(device.room_id) as any;
          hubId = room?.ha_hub_id;
        }
        let hub: HubRow | undefined;
        if (hubId) {
          hub = db.prepare('SELECT * FROM ha_hubs WHERE id = ?').get(hubId) as HubRow | undefined;
        }
        if (!hub) {
          hub = db.prepare('SELECT * FROM ha_hubs WHERE enabled = 1 LIMIT 1').get() as HubRow | undefined;
        }

        if (hub && hub.local_url && hub.access_token) {
          const haState = await HaService.getEntityState(hub.local_url, hub.access_token, device.entity_id);
          if (haState !== null) {
            const lower = haState.toLowerCase();
            if (device.type === 'climate') {
              return lower !== 'off' && lower !== 'unavailable' && lower !== 'unknown';
            }
            if (device.type === 'cover' || device.type === 'curtain') {
              return lower === 'open';
            }
            return lower === 'on';
          }
        }
      }

      // 3. Check Zigbee2MQTT
      const zName = (device as any).z2m_friendly_name || devConfig.z2m_friendly_name;
      if (zName) {
        const st = mqttService.getDeviceState(zName);
        if (st) {
          if (st.state !== undefined) {
            return String(st.state).toUpperCase() === 'ON';
          }
          // Multi-gang switch (e.g. state_l1, state_l2, state_l3, state_left, etc.)
          for (const key of Object.keys(st)) {
            if (key.startsWith('state_') && String(st[key]).toUpperCase() === 'ON') {
              return true;
            }
          }
        }
      }

      // 4. Check Tuya
      const tuyaId = (device as any).tuya_device_id || devConfig.tuya_device_id;
      if (tuyaId) {
        const st = tuyaService.getDeviceState(tuyaId);
        if (st) {
          if (st.switch_1 !== undefined) return Boolean(st.switch_1);
          if (st.switch !== undefined) return Boolean(st.switch);
          if (st.switch_led !== undefined) return Boolean(st.switch_led);
          for (const key of Object.keys(st)) {
            if (key.startsWith('switch') && Boolean(st[key])) {
              return true;
            }
          }
        }
      }

      // 5. Check virtual_device_states fallback
      const vState = db.prepare('SELECT state_json FROM virtual_device_states WHERE device_id = ?').get(deviceId) as any;
      if (vState) {
        try {
          const s = JSON.parse(vState.state_json);
          if (s.state !== undefined) return s.state === 'ON' || s.state === true;
          if (s.power !== undefined) return Boolean(s.power);
        } catch (_) {}
      }

      return false;
    } catch (_) {
      return false;
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
        } else if (trigger.type === 'cyclic' || trigger.type === 'interval') {
          // Cyclic duty-cycle auto-cutoff (e.g. AC is on after 3 hrs -> auto turn off for 15 mins -> resume on)
          const targetDeviceId = trigger.device_id;
          if (targetDeviceId) {
            const onMinutes = Math.max(1, Number(trigger.on_minutes) || 180); // Default 3 hours = 180 min
            const offMinutes = Math.max(1, Number(trigger.off_minutes) || 15); // Default 15 mins rest

            let inSchedule = true;
            if (!trigger.all_day && trigger.start_time && trigger.end_time) {
              if (trigger.days && !trigger.days.includes(currentDay)) {
                inSchedule = false;
              } else if (currentTimeStr < trigger.start_time || currentTimeStr > trigger.end_time) {
                inSchedule = false;
              }
            }

            let tracking: any = { phase: 'IDLE' };
            try {
              if (auto.last_trigger_state_key) {
                tracking = JSON.parse(auto.last_trigger_state_key);
              }
            } catch (_) {}

            const isCurrentlyOn = await this.isDeviceOn(targetDeviceId);

            if (!inSchedule) {
              if (tracking.phase !== 'IDLE') {
                const idleTracking = { phase: 'IDLE', reason: 'Outside operating window', device_state: isCurrentlyOn ? 'ON' : 'OFF' };
                db.prepare('UPDATE automations SET last_trigger_state_key = ? WHERE id = ?').run(JSON.stringify(idleTracking), auto.id);
                liveSync.broadcast('bootstrap_updated');
              }
            } else if (tracking.phase === 'CUTOFF') {
              const cutoffAt = tracking.cutoff_at || now.getTime();
              const elapsedRestMins = (now.getTime() - cutoffAt) / (60 * 1000);
              const remainingRestMins = Math.max(0, offMinutes - elapsedRestMins);

              if (elapsedRestMins >= offMinutes) {
                console.log(`[Scheduler] [Auto-Cutoff] Rest period (${offMinutes}m) complete for device ${targetDeviceId}. Resuming ON.`);
                await this.executeStep({
                  device_id: targetDeviceId,
                  action: 'turn_on',
                  value: { temp: trigger.resume_temp || 24, command: 'on' },
                });

                const newTracking = {
                  phase: 'RUNNING',
                  on_since: now.getTime(),
                  elapsed_mins: 0,
                  remaining_on_mins: onMinutes,
                  device_state: 'ON',
                  last_rest_at: now.toISOString(),
                };
                db.prepare('UPDATE automations SET last_trigger_state_key = ?, last_run_at = ? WHERE id = ?')
                  .run(JSON.stringify(newTracking), now.toISOString(), auto.id);

                liveSync.broadcast('automation_executed', {
                  id: auto.id,
                  name: auto.name,
                  message: `Rest complete (${offMinutes}m). Turned device back ON.`,
                });
                liveSync.broadcast('bootstrap_updated');
              } else {
                // Update live remaining rest minutes in state key
                const updatedTracking = {
                  ...tracking,
                  elapsed_rest_mins: Number(elapsedRestMins.toFixed(1)),
                  remaining_rest_mins: Number(remainingRestMins.toFixed(1)),
                  device_state: isCurrentlyOn ? 'ON' : 'RESTING (OFF)',
                };
                db.prepare('UPDATE automations SET last_trigger_state_key = ? WHERE id = ?').run(JSON.stringify(updatedTracking), auto.id);
              }
            } else {
              // IDLE or RUNNING
              if (!isCurrentlyOn) {
                if (tracking.phase !== 'IDLE' || tracking.device_state !== 'OFF') {
                  const idleTracking = {
                    phase: 'IDLE',
                    device_state: 'OFF',
                    message: 'Device is powered OFF. Waiting for power-on to start cycle.',
                  };
                  db.prepare('UPDATE automations SET last_trigger_state_key = ? WHERE id = ?').run(JSON.stringify(idleTracking), auto.id);
                  liveSync.broadcast('bootstrap_updated');
                }
              } else {
                // Device IS ON!
                const onSince = tracking.phase === 'RUNNING' && tracking.on_since ? tracking.on_since : now.getTime();
                const elapsedOnMins = (now.getTime() - onSince) / (60 * 1000);
                const remainingOnMins = Math.max(0, onMinutes - elapsedOnMins);

                if (elapsedOnMins >= onMinutes) {
                  console.log(`[Scheduler] [Auto-Cutoff] Device ${targetDeviceId} reached ${elapsedOnMins.toFixed(1)}m continuous runtime. Cutting OFF for ${offMinutes}m.`);
                  await this.executeStep({
                    device_id: targetDeviceId,
                    action: 'turn_off',
                  });

                  const newTracking = {
                    phase: 'CUTOFF',
                    cutoff_at: now.getTime(),
                    previous_run_mins: Number(elapsedOnMins.toFixed(1)),
                    elapsed_rest_mins: 0,
                    remaining_rest_mins: offMinutes,
                    device_state: 'RESTING (OFF)',
                  };
                  db.prepare('UPDATE automations SET last_trigger_state_key = ?, last_run_at = ? WHERE id = ?')
                    .run(JSON.stringify(newTracking), now.toISOString(), auto.id);

                  liveSync.broadcast('automation_executed', {
                    id: auto.id,
                    name: auto.name,
                    message: `Auto-cutoff triggered after ${Math.round(elapsedOnMins)} mins continuous run. Resting for ${offMinutes} mins.`,
                  });
                  liveSync.broadcast('bootstrap_updated');
                } else {
                  // Keep counting ON time
                  const runningTracking = {
                    phase: 'RUNNING',
                    on_since: onSince,
                    elapsed_mins: Number(elapsedOnMins.toFixed(1)),
                    remaining_on_mins: Number(remainingOnMins.toFixed(1)),
                    device_state: 'ON',
                  };
                  db.prepare('UPDATE automations SET last_trigger_state_key = ? WHERE id = ?').run(JSON.stringify(runningTracking), auto.id);
                }
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

    let trigger: any = {};
    try {
      trigger = JSON.parse(auto.trigger_json || '{}');
    } catch (_) {}

    // Special handling for Cyclic Auto-Cutoff testing
    if (trigger.type === 'cyclic') {
      const targetDeviceId = trigger.device_id;
      if (targetDeviceId) {
        const isCurrentlyOn = await this.isDeviceOn(targetDeviceId);
        // If device is currently ON, test cutoff (turn OFF); if OFF, test resume (turn ON)
        const testAction = isCurrentlyOn ? 'turn_off' : 'turn_on';
        await this.executeStep({
          device_id: targetDeviceId,
          action: testAction,
          value: { temp: trigger.resume_temp || 24, command: 'on' },
        });

        const nowIso = new Date().toISOString();
        db.prepare('UPDATE automations SET last_run_at = ?, last_error = NULL WHERE id = ?').run(nowIso, automationId);

        liveSync.broadcast('automation_executed', {
          id: automationId,
          name: auto.name,
          message: `Test run: Device turned ${testAction === 'turn_off' ? 'OFF (Cutoff test)' : 'ON (Resume test)'}`,
        });
        liveSync.broadcast('bootstrap_updated');

        return { success: true, executedSteps: 1 };
      }
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
    liveSync.broadcast('bootstrap_updated');

    return { success: true, executedSteps: executedCount };
  }

  public async executeStep(step: { device_id: string; action: string; value?: any; delay_ms?: number }) {
    if (step.action === 'delay') {
      const waitMs = step.delay_ms || (step.value?.minutes ? step.value.minutes * 60 * 1000 : 5000);
      await new Promise((res) => setTimeout(res, waitMs));
      return;
    }

    if (!step.device_id) return;

    if (step.delay_ms && step.delay_ms > 0) {
      await new Promise((res) => setTimeout(res, step.delay_ms));
    }

    const device = db.prepare('SELECT * FROM devices WHERE id = ?').get(step.device_id) as DeviceRow | undefined;
    if (!device) {
      console.warn(`[Scheduler] Device ${step.device_id} not found in database`);
      return;
    }

    let devConfig: any = {};
    try { devConfig = JSON.parse(device.config_json); } catch (_) {}

    // Direct Tuya execution check
    const tuyaId = (device as any).tuya_device_id || devConfig.tuya_device_id;

    if (tuyaId) {
      try {
        if (step.action === 'turn_off') {
          await tuyaService.setDeviceState(tuyaId, { switch_1: false, switch: false, switch_led: false });
        } else if (step.action === 'turn_on') {
          await tuyaService.setDeviceState(tuyaId, { switch_1: true, switch: true, switch_led: true });
        } else if (step.action === 'toggle') {
          const current = tuyaService.getDeviceState(tuyaId);
          const next = !(current?.switch_1 ?? current?.switch ?? false);
          await tuyaService.setDeviceState(tuyaId, { switch_1: next, switch: next });
        }
      } catch (err: any) {
        console.warn(`[Scheduler] Direct Tuya execution failed for ${tuyaId}:`, err.message);
      }
    }

    // TTLock handling
    if (device.type === 'ttlock') {
      const config = db.prepare('SELECT ttlock_client_id, ttlock_access_token, ttlock_legacy_url FROM building_config WHERE id = 1').get() as any;
      const lockId = devConfig.lockId || device.entity_id;
      if (lockId && config?.ttlock_access_token) {
        await TTLockService.unlock(config.ttlock_client_id, config.ttlock_access_token, lockId, config.ttlock_legacy_url);
      }
      return;
    }

    // Direct Zigbee2MQTT execution check
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

        if (irCode && hub?.local_url && hub?.access_token) {
          // Send to IR text entity
          await HaService.callService(hub.local_url, hub.access_token, 'text', 'set_value', {
            entity_id: entityId,
            value: irCode,
          });
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
