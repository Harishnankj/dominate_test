import type { BootstrapData, BuildingConfig, Floor, Room, Device, Camera, IrProfile, Automation, PresetScene, User } from '../types';

export class ApiService {
  private static async request<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };

    const res = await fetch(endpoint, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (!res.ok) {
      let errText = res.statusText;
      try {
        const raw = await res.text();
        try {
          const json = JSON.parse(raw);
          errText = json.error || json.message || raw || errText;
        } catch {
          errText = raw || errText;
        }
      } catch (_) {}
      throw new Error(errText || `API error ${res.status}`);
    }

    return res.json();
  }

  // Bootstrap
  static async getBootstrap(): Promise<BootstrapData> {
    return this.request<BootstrapData>('/api/bootstrap');
  }

  // Auth
  static async login(email: string, password: string): Promise<{ ok: boolean; user: User; token: string }> {
    return this.request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  static async register(name: string, email: string, password: string, phone?: string): Promise<{ ok: boolean; user: User; token: string }> {
    return this.request('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, phone }),
    });
  }

  static async logout(): Promise<{ ok: boolean }> {
    return this.request('/api/auth/logout', { method: 'POST' });
  }

  static async verifyHomeKey(homeKey: string): Promise<{ valid: boolean }> {
    return this.request('/api/auth/verify-home-key', {
      method: 'POST',
      body: JSON.stringify({ homeKey }),
    });
  }

  // Home Assistant
  static async testHaConnection(data: { local_url?: string; access_token?: string; hub_id?: string }): Promise<any> {
    return this.request('/api/admin/ha-test', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async discoverHaEntities(hubId: string): Promise<{ ok: boolean; hubId: string; entities: any[] }> {
    return this.request(`/api/admin/ha-discover/${hubId}`);
  }

  static async autoImportHaAreas(hubId: string): Promise<{ ok: boolean; importedRooms: number; importedDevices: number }> {
    return this.request(`/api/admin/ha-import-areas/${hubId}`, { method: 'POST' });
  }

  static async addHub(hub: { name: string; local_url: string; cloud_url?: string; access_token: string; enabled?: number }): Promise<{ ok: boolean; id: string }> {
    return this.request('/api/admin/hubs', {
      method: 'POST',
      body: JSON.stringify(hub),
    });
  }

  static async updateHub(id: string, hub: Partial<{ name: string; local_url: string; cloud_url: string; access_token: string; enabled: number }>): Promise<{ ok: boolean }> {
    return this.request(`/api/admin/hubs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(hub),
    });
  }

  static async deleteHub(id: string): Promise<{ ok: boolean }> {
    return this.request(`/api/admin/hubs/${id}`, { method: 'DELETE' });
  }

  static async generateHomeKey(require_home_key?: boolean): Promise<{ ok: boolean; homeKey: string; preview: string; hash: string }> {
    return this.request('/api/admin/generate-homekey', {
      method: 'POST',
      body: JSON.stringify({ require_home_key }),
    });
  }

  // Floors, Rooms & Devices
  static async addFloor(floor: Partial<Floor>): Promise<{ ok: boolean; id: string }> {
    return this.request('/api/admin/floors', { method: 'POST', body: JSON.stringify(floor) });
  }

  static async updateFloor(id: string, floor: Partial<Floor>): Promise<{ ok: boolean }> {
    return this.request(`/api/admin/floors/${id}`, { method: 'PUT', body: JSON.stringify(floor) });
  }

  static async deleteFloor(id: string): Promise<{ ok: boolean }> {
    return this.request(`/api/admin/floors/${id}`, { method: 'DELETE' });
  }

  static async addRoom(room: Partial<Room> & { aliases?: string[] }): Promise<{ ok: boolean; id: string }> {
    return this.request('/api/admin/rooms', { method: 'POST', body: JSON.stringify(room) });
  }

  static async updateRoom(id: string, room: Partial<Room> & { aliases?: string[] }): Promise<{ ok: boolean }> {
    return this.request(`/api/admin/rooms/${id}`, { method: 'PUT', body: JSON.stringify(room) });
  }

  static async deleteRoom(id: string): Promise<{ ok: boolean }> {
    return this.request(`/api/admin/rooms/${id}`, { method: 'DELETE' });
  }

  static async addDevice(device: any): Promise<{ ok: boolean; id: string }> {
    return this.request('/api/admin/devices', { method: 'POST', body: JSON.stringify(device) });
  }

  static async updateDevice(id: string, device: any): Promise<{ ok: boolean }> {
    return this.request(`/api/admin/devices/${id}`, { method: 'PUT', body: JSON.stringify(device) });
  }

  static async deleteDevice(id: string): Promise<{ ok: boolean }> {
    return this.request(`/api/admin/devices/${id}`, { method: 'DELETE' });
  }

  static async setVirtualDeviceState(deviceId: string, state: Record<string, any>): Promise<{ ok: boolean }> {
    return this.request(`/api/devices/${deviceId}/virtual-state`, {
      method: 'POST',
      body: JSON.stringify({ state }),
    });
  }

  static async sendAcIrCommand(deviceId: string, commandKey: string, stateSnapshot?: any): Promise<{ ok: boolean }> {
    return this.request('/api/devices/ac-ir/send', {
      method: 'POST',
      body: JSON.stringify({ deviceId, commandKey, stateSnapshot }),
    });
  }

  static async sendBlindsRelayCommand(deviceId: string, action: 'open' | 'close' | 'stop'): Promise<{ ok: boolean; action: string }> {
    return this.request('/api/devices/blinds-relay/command', {
      method: 'POST',
      body: JSON.stringify({ deviceId, action }),
    });
  }

  static async callHaService(domain: string, service: string, service_data?: any, hub_id?: string): Promise<{ ok: boolean; result: any }> {
    return this.request('/api/devices/ha-call', {
      method: 'POST',
      body: JSON.stringify({ domain, service, service_data, hub_id }),
    });
  }



  // Global Building Lock Control
  static async lockAllDoors(): Promise<{ ok: boolean; total: number; locked: number; results: any[] }> {
    return this.request('/api/devices/lock-all', { method: 'POST' });
  }

  static async unlockTuyaDevice(deviceId: string): Promise<{ ok: boolean; message: string }> {
    return this.request('/api/tuya/unlock', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId }),
    });
  }

  static async lockTuyaDevice(deviceId: string): Promise<{ ok: boolean; message: string }> {
    return this.request('/api/tuya/lock', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId }),
    });
  }

  static async getTuyaLockStatus(deviceId: string): Promise<{ ok: boolean; battery?: number; locked?: boolean; online?: boolean; rawStatus?: Record<string, any>; message?: string }> {
    return this.request(`/api/tuya/devices/${deviceId}/status`);
  }

  static async generateTuyaOtp(deviceId: string): Promise<{ ok: boolean; otp?: string; expiresIn?: number; message?: string }> {
    return this.request(`/api/tuya/devices/${deviceId}/dynamic-password`, { method: 'POST' });
  }

  static async getTuyaLockLogs(deviceId: string): Promise<{ ok: boolean; logs?: any[]; message?: string }> {
    return this.request(`/api/tuya/devices/${deviceId}/logs`);
  }

  static async getTuyaLiveStream(deviceId: string): Promise<{ ok: boolean; stream_id?: string; rtsp_url?: string; hls_url?: string; message?: string }> {
    return this.request(`/api/tuya/devices/${deviceId}/stream`, { method: 'POST' });
  }

  // Cameras
  static async addCamera(camera: any): Promise<{ ok: boolean; id: string }> {
    return this.request('/api/admin/cameras', { method: 'POST', body: JSON.stringify(camera) });
  }

  static async updateCamera(id: string, camera: any): Promise<{ ok: boolean }> {
    return this.request(`/api/admin/cameras/${id}`, { method: 'PUT', body: JSON.stringify(camera) });
  }

  static async deleteCamera(id: string): Promise<{ ok: boolean }> {
    return this.request(`/api/admin/cameras/${id}`, { method: 'DELETE' });
  }

  static async testOnvifPtz(data: { ip: string; port?: number; username?: string; password?: string }): Promise<{ ok: boolean; supported: boolean; message: string }> {
    return this.request('/api/admin/ptz-test', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async controlOnvifPtz(cameraId: string, action: 'move' | 'stop', x: number = 0, y: number = 0, zoom: number = 0): Promise<{ ok: boolean }> {
    return this.request(`/api/admin/cameras/${cameraId}/ptz`, {
      method: 'POST',
      body: JSON.stringify({ action, x, y, zoom }),
    });
  }

  static async probeOnvif(data?: { ip?: string; port?: number; username?: string; password?: string }): Promise<{ ok: boolean; devices: any[]; error?: string }> {
    return this.request('/api/admin/cameras/probe-onvif', {
      method: 'POST',
      body: JSON.stringify(data || {}),
    });
  }

  static async ptzCamera(
    cameraId: string,
    params: { direction?: string; action?: 'move' | 'stop'; speed?: number; durationMs?: number } | ('move' | 'stop'),
    x: number = 0,
    y: number = 0,
    zoom: number = 0
  ): Promise<{ ok: boolean }> {
    if (typeof params === 'object') {
      return this.request(`/api/admin/cameras/${cameraId}/ptz`, {
        method: 'POST',
        body: JSON.stringify(params),
      });
    }
    return this.controlOnvifPtz(cameraId, params, x, y, zoom);
  }

  // IR Profiles
  static async addIrProfile(profile: any): Promise<{ ok: boolean; id: string }> {
    return this.request('/api/admin/ir-profiles', { method: 'POST', body: JSON.stringify(profile) });
  }

  static async updateIrProfile(id: string, profile: any): Promise<{ ok: boolean }> {
    return this.request(`/api/admin/ir-profiles/${id}`, { method: 'PUT', body: JSON.stringify(profile) });
  }

  static async deleteIrProfile(id: string): Promise<{ ok: boolean }> {
    return this.request(`/api/admin/ir-profiles/${id}`, { method: 'DELETE' });
  }

  static async testIrCode(data: { hub_id?: string; entity_id: string; code: string }): Promise<{ ok: boolean }> {
    return this.request('/api/admin/ir-test', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async learnIrCode(data: { hub_id?: string; learn_entity: string; sensor_entity: string }): Promise<{ ok: boolean; code?: string; message?: string }> {
    return this.request('/api/admin/ir-learn', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // TTLock
  static async testTtlock(credentials: {
    client_id: string;
    client_secret: string;
    username: string;
    password?: string;
  }): Promise<{ ok: boolean; totalLocks: number; locks: any[]; error?: string }> {
    return this.request('/api/admin/ttlock-test', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  }

  static async unlockTtlock(lockId: string | number): Promise<{ ok: boolean; message: string }> {
    return this.request('/api/admin/ttlock-unlock', {
      method: 'POST',
      body: JSON.stringify({ lock_id: lockId }),
    });
  }

  static async lockTtlock(lockId: string | number): Promise<{ ok: boolean; message: string }> {
    return this.request('/api/admin/ttlock-lock', {
      method: 'POST',
      body: JSON.stringify({ lock_id: lockId }),
    });
  }

  static async generateTtlockPasscode(lockId: string | number, type: number = 1): Promise<{
    ok: boolean;
    passcode?: string;
    message: string;
  }> {
    return this.request('/api/admin/ttlock-passcode', {
      method: 'POST',
      body: JSON.stringify({ lock_id: lockId, type }),
    });
  }

  static async getTtlockRecords(lockId: string | number): Promise<{
    ok: boolean;
    records: Array<{ id: string; timestamp: number; unlockMethod: string; user?: string; status: string }>;
  }> {
    return this.request(`/api/admin/ttlock-records/${lockId}`);
  }

  static async getTtlockDetail(lockId: string | number): Promise<{
    ok: boolean;
    electricQuantity?: number;
    detail?: any;
  }> {
    return this.request(`/api/admin/ttlock-detail/${lockId}`);
  }

  // Building Config & Backup
  static async updateConfig(fields: Partial<BuildingConfig>): Promise<{ ok: boolean }> {
    return this.request('/api/admin/config', { method: 'POST', body: JSON.stringify(fields) });
  }

  static async exportBackup(): Promise<any> {
    return this.request('/api/admin/backup/export');
  }

  static async importBackup(data: any): Promise<{ ok: boolean }> {
    return this.request('/api/admin/backup/import', { method: 'POST', body: JSON.stringify(data) });
  }

  static async exportConfig(): Promise<any> {
    return this.exportBackup();
  }

  static async importConfig(data: any): Promise<{ ok: boolean }> {
    return this.importBackup(data);
  }

  // Weather & News
  static async fetchWeather(): Promise<any> {
    return this.request('/api/weather');
  }

  static async fetchNews(): Promise<any> {
    return this.request('/api/news');
  }

  // Automations
  static async fetchAutomations(): Promise<{ ok: boolean; automations: Automation[] }> {
    return this.request('/api/automations');
  }

  static async addAutomation(data: any): Promise<{ ok: boolean; id: string }> {
    return this.request('/api/automations', { method: 'POST', body: JSON.stringify(data) });
  }

  static async updateAutomation(id: string, data: any): Promise<{ ok: boolean }> {
    return this.request(`/api/automations/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  static async deleteAutomation(id: string): Promise<{ ok: boolean }> {
    return this.request(`/api/automations/${id}`, { method: 'DELETE' });
  }

  static async runAutomation(id: string): Promise<{ ok: boolean; success: boolean; executedSteps: number }> {
    return this.request(`/api/automations/${id}/run`, { method: 'POST' });
  }

  // Architectural Presets & Building Scenes
  static async fetchPresets(): Promise<{ ok: boolean; presets: PresetScene[] }> {
    return this.request('/api/presets');
  }

  static async updatePreset(id: string, data: Partial<PresetScene>): Promise<{ ok: boolean; message?: string }> {
    return this.request(`/api/presets/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  static async runPreset(id: string): Promise<{ ok: boolean; success: boolean; name?: string; executedActions?: number }> {
    return this.request(`/api/presets/${id}/run`, { method: 'POST' });
  }

  static async resetPreset(id: string): Promise<{ ok: boolean; message?: string }> {
    return this.request(`/api/presets/${id}/reset`, { method: 'POST' });
  }

  // Zigbee2MQTT / MQTT
  static async getZ2mStatus(): Promise<{ ok: boolean; status: import('../types').Z2mStatus; states: Record<string, any> }> {
    return this.request('/api/z2m/status');
  }

  static async getZ2mDevices(): Promise<{ ok: boolean; count: number; devices: import('../types').Z2mDevice[] }> {
    return this.request('/api/z2m/devices');
  }

  static async setZ2mDeviceState(friendlyName: string, state: Record<string, any>): Promise<{ ok: boolean }> {
    return this.request('/api/z2m/set', {
      method: 'POST',
      body: JSON.stringify({ friendly_name: friendlyName, state }),
    });
  }

  static async getZ2mHubs(): Promise<{ ok: boolean; hubs: import('../types').Z2mHub[] }> {
    return this.request('/api/z2m/hubs');
  }

  static async createZ2mHub(data: Partial<import('../types').Z2mHub>): Promise<{ ok: boolean; hub: import('../types').Z2mHub }> {
    return this.request('/api/z2m/hubs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async updateZ2mHub(id: string, data: Partial<import('../types').Z2mHub>): Promise<{ ok: boolean; hub: import('../types').Z2mHub }> {
    return this.request(`/api/z2m/hubs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  static async deleteZ2mHub(id: string): Promise<{ ok: boolean }> {
    return this.request(`/api/z2m/hubs/${id}`, {
      method: 'DELETE',
    });
  }

  static async updateZ2mConfig(data: {
    enabled: boolean;
    brokerUrl: string;
    username?: string;
    password?: string;
    baseTopic?: string;
  }): Promise<{ ok: boolean; status: import('../types').Z2mStatus }> {
    return this.request('/api/z2m/config', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async setZ2mPermitJoin(time: number = 254, hubId?: string): Promise<{ ok: boolean; permit_join: boolean }> {
    return this.request('/api/z2m/permit-join', {
      method: 'POST',
      body: JSON.stringify({ time, hubId }),
    });
  }

  static async autoImportZ2mDevices(floorId?: string, roomId?: string): Promise<{ ok: boolean; imported: number; totalDiscovered?: number }> {
    return this.request('/api/z2m/auto-import', {
      method: 'POST',
      body: JSON.stringify({ floorId, roomId }),
    });
  }

  // Tuya & Direct Wi-Fi Hub
  static async getTuyaStatus(): Promise<{ ok: boolean; status: import('../types').TuyaStatus; states: Record<string, any> }> {
    return this.request('/api/tuya/status');
  }

  static async getTuyaDevices(): Promise<{ ok: boolean; count: number; devices: import('../types').TuyaDevice[] }> {
    return this.request('/api/tuya/devices');
  }

  static async syncTuyaCloud(): Promise<{ ok: boolean; count: number; devices: import('../types').TuyaDevice[] }> {
    return this.request('/api/tuya/sync', { method: 'POST' });
  }

  static async setTuyaDeviceState(deviceId: string, state: Record<string, any>): Promise<{ ok: boolean }> {
    return this.request('/api/tuya/set', {
      method: 'POST',
      body: JSON.stringify({ device_id: deviceId, state }),
    });
  }


  static async updateTuyaConfig(data: {
    enabled: boolean;
    accessId: string;
    accessSecret?: string;
    region: string;
    uid?: string;
  }): Promise<{ ok: boolean; status: import('../types').TuyaStatus }> {
    return this.request('/api/tuya/config', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  static async autoImportTuyaDevices(floorId?: string, roomId?: string): Promise<{ ok: boolean; imported: number; totalDiscovered?: number }> {
    return this.request('/api/tuya/auto-import', {
      method: 'POST',
      body: JSON.stringify({ floorId, roomId }),
    });
  }

  static async addManualTuyaDevice(data: {
    name: string;
    tuya_device_id: string;
    tuya_local_key?: string;
    tuya_ip?: string;
    type?: string;
    room_id: string;
  }): Promise<{ ok: boolean; id: string }> {
    return this.request('/api/tuya/devices/manual', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Virtual States, AC IR & Relay Blinds
  static async setVirtualState(deviceId: string, state: Record<string, any>): Promise<{ ok: boolean }> {
    return this.request(`/api/devices/${deviceId}/virtual-state`, {
      method: 'POST',
      body: JSON.stringify({ state }),
    });
  }

  static async sendAcIr(deviceId: string, commandKey: string, stateSnapshot?: any): Promise<{ ok: boolean }> {
    return this.request('/api/devices/ac-ir/send', {
      method: 'POST',
      body: JSON.stringify({ deviceId, commandKey, stateSnapshot }),
    });
  }

  static async moveRelayBlinds(deviceId: string, action: 'open' | 'close' | 'stop'): Promise<{ ok: boolean }> {
    return this.request('/api/devices/relay-blinds/move', {
      method: 'POST',
      body: JSON.stringify({ deviceId, action }),
    });
  }
}
