import type { BootstrapData, BuildingConfig, Floor, Room, Device, Camera, IrProfile, Automation, User } from '../types';

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

  static async addHub(hub: { name: string; local_url: string; cloud_url?: string; access_token: string }): Promise<{ ok: boolean; id: string }> {
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

  // Cameras & Go2RTC
  static async fetchGo2rtcStreams(): Promise<{ ok: boolean; streams: Record<string, any> }> {
    return this.request('/api/admin/go2rtc/streams');
  }

  static async addCamera(camera: Partial<Camera>): Promise<{ ok: boolean; id: string }> {
    return this.request('/api/admin/cameras', { method: 'POST', body: JSON.stringify(camera) });
  }

  static async updateCamera(id: string, camera: Partial<Camera>): Promise<{ ok: boolean }> {
    return this.request(`/api/admin/cameras/${id}`, { method: 'PUT', body: JSON.stringify(camera) });
  }

  static async deleteCamera(id: string): Promise<{ ok: boolean }> {
    return this.request(`/api/admin/cameras/${id}`, { method: 'DELETE' });
  }

  static async ptzCamera(
    id: string,
    params: { action?: 'move' | 'stop'; direction?: string; speed?: number; durationMs?: number }
  ): Promise<{ ok: boolean; direction?: string; speed?: number; error?: string }> {
    return this.request(`/api/cameras/${id}/ptz`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  // IR Profiles
  static async fetchIrProfiles(): Promise<{ ok: boolean; profiles: IrProfile[] }> {
    return this.request('/api/admin/ir-profiles');
  }

  static async addIrProfile(profile: { name: string; brand?: string; commands: Record<string, string> }): Promise<{ ok: boolean; id: string }> {
    return this.request('/api/admin/ir-profiles', { method: 'POST', body: JSON.stringify(profile) });
  }

  static async updateIrProfile(id: string, profile: { name?: string; brand?: string; commands?: Record<string, string> }): Promise<{ ok: boolean }> {
    return this.request(`/api/admin/ir-profiles/${id}`, { method: 'PUT', body: JSON.stringify(profile) });
  }

  static async deleteIrProfile(id: string): Promise<{ ok: boolean }> {
    return this.request(`/api/admin/ir-profiles/${id}`, { method: 'DELETE' });
  }

  static async testIrCode(data: { hub_id?: string; entity_id: string; code: string }): Promise<any> {
    return this.request('/api/admin/ir-test', { method: 'POST', body: JSON.stringify(data) });
  }

  static async learnIrCode(data: { hub_id?: string; learn_entity: string; sensor_entity: string }): Promise<{ ok: boolean; code?: string; message: string }> {
    return this.request('/api/admin/ir-learn', { method: 'POST', body: JSON.stringify(data) });
  }

  // TTLock
  static async testTtlock(credentials: any): Promise<any> {
    return this.request('/api/admin/ttlock-test', { method: 'POST', body: JSON.stringify(credentials) });
  }

  static async unlockTtlock(lockId: string | number): Promise<any> {
    return this.request('/api/admin/ttlock-unlock', { method: 'POST', body: JSON.stringify({ lock_id: lockId }) });
  }

  // Config Update, Export, Import
  static async updateConfig(config: Partial<BuildingConfig>): Promise<{ ok: boolean }> {
    return this.request('/api/admin/config', { method: 'POST', body: JSON.stringify(config) });
  }

  static async exportConfig(): Promise<any> {
    return this.request('/api/admin/export');
  }

  static async importConfig(payload: any): Promise<{ ok: boolean; message: string }> {
    return this.request('/api/admin/import', { method: 'POST', body: JSON.stringify(payload) });
  }

  // Device Actions
  static async sendAcIr(deviceId: string, commandKey: string, stateSnapshot?: any): Promise<any> {
    return this.request('/api/devices/ac-ir/send', {
      method: 'POST',
      body: JSON.stringify({ deviceId, commandKey, stateSnapshot }),
    });
  }

  static async moveRelayBlinds(deviceId: string, action: 'open' | 'close' | 'stop'): Promise<any> {
    return this.request('/api/devices/relay-blinds/move', {
      method: 'POST',
      body: JSON.stringify({ deviceId, action }),
    });
  }

  static async setVirtualState(deviceId: string, state: any): Promise<any> {
    return this.request(`/api/devices/${deviceId}/virtual-state`, {
      method: 'POST',
      body: JSON.stringify({ state }),
    });
  }

  // Attendance
  static async fetchAttendance(): Promise<{ ok: boolean; logs: any[] }> {
    return this.request('/api/hr/attendance');
  }

  static async punchAttendance(data: { employeeId: string; employeeName: string; department?: string; type: 'IN' | 'OUT' }): Promise<any> {
    return this.request('/api/hr/punch', { method: 'POST', body: JSON.stringify(data) });
  }

  static async uploadAttendanceBatch(content: string, format: 'csv' | 'json'): Promise<any> {
    return this.request('/api/hr/batch-upload', { method: 'POST', body: JSON.stringify({ content, format }) });
  }

  // Misc
  static async fetchWeather(lat?: number, lon?: number): Promise<any> {
    const q = lat && lon ? `?lat=${lat}&lon=${lon}` : '';
    return this.request(`/api/weather${q}`);
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

  static async setZ2mPermitJoin(time: number = 254): Promise<{ ok: boolean; permit_join: boolean }> {
    return this.request('/api/z2m/permit-join', {
      method: 'POST',
      body: JSON.stringify({ time }),
    });
  }

  static async autoImportZ2mDevices(floorId?: string, roomId?: string): Promise<{ ok: boolean; imported: number; totalDiscovered?: number }> {
    return this.request('/api/z2m/auto-import', {
      method: 'POST',
      body: JSON.stringify({ floorId, roomId }),
    });
  }
}
