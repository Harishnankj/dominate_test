import WebSocket from 'ws';

export interface HaTestResult {
  ok: boolean;
  haVersion?: string;
  totalEntities?: number;
  domains?: Record<string, number>;
  error?: string;
}

export interface DiscoveredEntity {
  entity_id: string;
  friendly_name: string;
  domain: string;
  state: string;
  attributes: Record<string, any>;
  area_name?: string;
  is_mapped?: boolean;
}

export class HaService {
  /**
   * Test connection to Home Assistant using REST API
   */
  static async testConnection(baseUrl: string, token: string): Promise<HaTestResult> {
    try {
      const cleanUrl = baseUrl.replace(/\/+$/, '');
      const headers = {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // 1. Fetch HA status
      const statusRes = await fetch(`${cleanUrl}/api/`, { headers });
      if (!statusRes.ok) {
        return {
          ok: false,
          error: `HTTP error ${statusRes.status}: ${statusRes.statusText}`,
        };
      }

      const statusData = (await statusRes.json()) as any;
      const haVersion = statusData.version || 'Home Assistant';

      // 2. Fetch States to count entities by domain
      const statesRes = await fetch(`${cleanUrl}/api/states`, { headers });
      if (!statesRes.ok) {
        return {
          ok: true,
          haVersion,
          totalEntities: 0,
          domains: {},
        };
      }

      const states = (await statesRes.json()) as any[];
      const domains: Record<string, number> = {};
      for (const s of states) {
        const domain = s.entity_id ? s.entity_id.split('.')[0] : 'unknown';
        domains[domain] = (domains[domain] || 0) + 1;
      }

      return {
        ok: true,
        haVersion,
        totalEntities: states.length,
        domains,
      };
    } catch (err: any) {
      return {
        ok: false,
        error: err.message || 'Failed to connect to Home Assistant hub',
      };
    }
  }

  /**
   * Discover all entities from a Home Assistant Hub with area mapping
   */
  static async discoverEntities(baseUrl: string, token: string): Promise<DiscoveredEntity[]> {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // 1. Fetch live states
    const res = await fetch(`${cleanUrl}/api/states`, { headers });
    if (!res.ok) {
      throw new Error(`Failed to fetch entities: ${res.statusText}`);
    }
    const states = (await res.json()) as any[];

    // 2. Query HA WebSocket registries (area, device, entity) for area resolution
    let entityToArea: Record<string, string> = {};
    try {
      const wsUrl = cleanUrl.replace(/^http/, 'ws') + '/api/websocket';
      const ws = new WebSocket(wsUrl);

      let areas: any[] = [];
      let devices: any[] = [];
      let entities: any[] = [];

      await new Promise<void>((resolve) => {
        let received = 0;
        const timer = setTimeout(() => {
          try { ws.terminate(); } catch (_) {}
          resolve();
        }, 2500);

        ws.on('message', (msg) => {
          try {
            const data = JSON.parse(msg.toString());
            if (data.type === 'auth_required') {
              ws.send(JSON.stringify({ type: 'auth', access_token: token }));
            } else if (data.type === 'auth_ok') {
              ws.send(JSON.stringify({ id: 1, type: 'config/area_registry/list' }));
              ws.send(JSON.stringify({ id: 2, type: 'config/device_registry/list' }));
              ws.send(JSON.stringify({ id: 3, type: 'config/entity_registry/list' }));
            } else if (data.id === 1) {
              areas = data.result || [];
              if (++received === 3) { clearTimeout(timer); ws.close(); resolve(); }
            } else if (data.id === 2) {
              devices = data.result || [];
              if (++received === 3) { clearTimeout(timer); ws.close(); resolve(); }
            } else if (data.id === 3) {
              entities = data.result || [];
              if (++received === 3) { clearTimeout(timer); ws.close(); resolve(); }
            }
          } catch (_) {
            clearTimeout(timer);
            resolve();
          }
        });

        ws.on('error', () => {
          clearTimeout(timer);
          resolve();
        });

        ws.on('close', () => {
          clearTimeout(timer);
          resolve();
        });
      });

      // Build map
      const areaIdToName: Record<string, string> = {};
      if (Array.isArray(areas)) {
        areas.forEach((a) => { if (a.area_id && a.name) areaIdToName[a.area_id] = a.name; });
      }
      const deviceIdToAreaId: Record<string, string> = {};
      if (Array.isArray(devices)) {
        devices.forEach((d) => { if (d.id && d.area_id) deviceIdToAreaId[d.id] = d.area_id; });
      }
      if (Array.isArray(entities)) {
        entities.forEach((e) => {
          const areaId = e.area_id || (e.device_id && deviceIdToAreaId[e.device_id]);
          if (areaId && areaIdToName[areaId]) {
            entityToArea[e.entity_id] = areaIdToName[areaId];
          }
        });
      }
    } catch (_) {
      // WS registry lookup is best-effort
    }

    return states.map((s) => ({
      entity_id: s.entity_id,
      friendly_name: s.attributes?.friendly_name || s.entity_id,
      domain: s.entity_id.split('.')[0],
      state: s.state,
      attributes: s.attributes || {},
      area_name: entityToArea[s.entity_id] || s.attributes?.area_name || undefined,
    }));
  }

  /**
   * Call a service on Home Assistant
   */
  static async callService(baseUrl: string, token: string, domain: string, service: string, serviceData: any = {}) {
    const cleanUrl = baseUrl.replace(/\/+$/, '');
    const res = await fetch(`${cleanUrl}/api/services/${domain}/${service}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(serviceData),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`HA Service error (${res.status}): ${txt}`);
    }

    return await res.json();
  }
}
