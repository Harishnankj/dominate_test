import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { BootstrapData, Floor, Room, Device, Camera, IrProfile, Automation, Z2mStatus, Z2mDevice, TuyaStatus, TuyaDevice } from '../types';
import { ApiService } from '../services/api';

interface BootstrapContextType {
  data: BootstrapData | null;
  loading: boolean;
  refreshBootstrap: () => Promise<void>;
  getRoom: (idOrSlug: string) => Room | undefined;
  getFloor: (idOrSlug: string) => Floor | undefined;
  getDevicesForRoom: (roomId: string) => Device[];
  getCamerasForFloor: (floorId?: string) => Camera[];
  getCamerasForRoom: (roomId: string) => Camera[];
  getVirtualState: (deviceId: string) => any;
  setVirtualState: (deviceId: string, state: any) => Promise<void>;
  isLiveSyncConnected: boolean;
  z2mStatus: Z2mStatus | null;
  z2mStates: Record<string, any>;
  z2mDevices: Z2mDevice[];
  getZ2mState: (friendlyName: string) => Record<string, any> | undefined;
  setZ2mState: (friendlyName: string, state: Record<string, any>) => Promise<boolean>;
  getZ2mDevice: (friendlyNameOrIeee: string) => Z2mDevice | undefined;
  tuyaStatus: TuyaStatus | null;
  tuyaStates: Record<string, any>;
  tuyaDevices: TuyaDevice[];
  getTuyaState: (deviceId: string) => Record<string, any> | undefined;
  setTuyaState: (deviceId: string, state: Record<string, any>) => Promise<boolean>;
  getTuyaDevice: (deviceId: string) => TuyaDevice | undefined;
}

const BootstrapContext = createContext<BootstrapContextType | undefined>(undefined);

export const BootstrapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiveSyncConnected, setIsLiveSyncConnected] = useState(false);
  const [z2mStatus, setZ2mStatus] = useState<Z2mStatus | null>(null);
  const [z2mStates, setZ2mStates] = useState<Record<string, any>>({});
  const [z2mDevices, setZ2mDevices] = useState<Z2mDevice[]>([]);
  const [tuyaStatus, setTuyaStatus] = useState<TuyaStatus | null>(null);
  const [tuyaStates, setTuyaStates] = useState<Record<string, any>>({});
  const [tuyaDevices, setTuyaDevices] = useState<TuyaDevice[]>([]);

  const fetchBootstrap = useCallback(async () => {
    try {
      const res = await ApiService.getBootstrap();
      setData(res);
      if (res.z2m_status) setZ2mStatus(res.z2m_status);
      if (res.z2m_devices) setZ2mDevices(res.z2m_devices);
      if (res.z2m_states) setZ2mStates(res.z2m_states);
      if (res.tuya_status) setTuyaStatus(res.tuya_status);
      if (res.tuya_devices) setTuyaDevices(res.tuya_devices);
      if (res.tuya_states) setTuyaStates(res.tuya_states);
    } catch (err) {
      console.warn('[BootstrapContext] Failed to load bootstrap:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBootstrap();
    // Load initial Zigbee2MQTT states and devices
    ApiService.getZ2mStatus()
      .then((res) => {
        if (res.ok) {
          setZ2mStatus(res.status);
          if (res.states) {
            setZ2mStates((prev) => ({ ...prev, ...res.states }));
          }
        }
      })
      .catch(() => { });

    ApiService.getZ2mDevices()
      .then((res) => {
        if (res.ok && res.devices) {
          setZ2mDevices(res.devices);
        }
      })
      .catch(() => { });

    // Load initial Tuya states and devices
    ApiService.getTuyaStatus()
      .then((res) => {
        if (res.ok) {
          setTuyaStatus(res.status);
          if (res.states) {
            setTuyaStates((prev) => ({ ...prev, ...res.states }));
          }
        }
      })
      .catch(() => { });

    ApiService.getTuyaDevices()
      .then((res) => {
        if (res.ok && res.devices) {
          setTuyaDevices(res.devices);
        }
      })
      .catch(() => { });
  }, [fetchBootstrap]);

  // Connect to Live Sync WebSocket (/api/live-sync)
  useEffect(() => {
    let ws: WebSocket | null = null;
    let timer: any = null;
    let isDisposed = false;

    const connectLiveSync = () => {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live-sync`;

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          if (!isDisposed) setIsLiveSyncConnected(true);
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === 'bootstrap_updated') {
              console.log('[LiveSync] Bootstrap updated on server, hot-reloading state...');
              fetchBootstrap();
            } else if (msg.type === 'virtual_state_updated') {
              const { deviceId, state } = msg.payload || {};
              if (deviceId) {
                setData((prev) => {
                  if (!prev) return prev;
                  return {
                    ...prev,
                    virtual_device_states: {
                      ...prev.virtual_device_states,
                      [deviceId]: state,
                    },
                  };
                });
              }
            } else if (msg.type === 'z2m_state_changed') {
              const { friendly_name, state } = msg.payload || {};
              if (friendly_name) {
                setZ2mStates((prev) => ({
                  ...prev,
                  [friendly_name]: { ...prev[friendly_name], ...state },
                }));
              }
            } else if (msg.type === 'z2m_devices_updated') {
              const { devices } = msg.payload || {};
              if (Array.isArray(devices)) {
                setZ2mDevices(devices);
              }
            } else if (msg.type === 'z2m_status_changed') {
              setZ2mStatus(msg.payload);
            } else if (msg.type === 'tuya_state_changed') {
              const { device_id, state } = msg.payload || {};
              if (device_id) {
                setTuyaStates((prev) => ({
                  ...prev,
                  [device_id]: { ...prev[device_id], ...state },
                }));
              }
            } else if (msg.type === 'tuya_devices_updated') {
              const { devices } = msg.payload || {};
              if (Array.isArray(devices)) {
                setTuyaDevices(devices);
              }
            } else if (msg.type === 'tuya_status_changed') {
              setTuyaStatus(msg.payload);
            }
          } catch (_) { }
        };

        ws.onclose = () => {
          if (!isDisposed) {
            setIsLiveSyncConnected(false);
            timer = setTimeout(connectLiveSync, 3000);
          }
        };

        ws.onerror = () => {
          if (!isDisposed) {
            setIsLiveSyncConnected(false);
            try { ws?.close(); } catch (_) { }
          }
        };
      } catch (e) {
        if (!isDisposed) {
          timer = setTimeout(connectLiveSync, 3000);
        }
      }
    };

    connectLiveSync();

    return () => {
      isDisposed = true;
      if (timer) clearTimeout(timer);
      try { ws?.close(); } catch (_) { }
    };
  }, [fetchBootstrap]);

  const getRoom = useCallback(
    (idOrSlug: string) => {
      if (!data) return undefined;
      return data.rooms.find((r) => r.id === idOrSlug || r.slug === idOrSlug);
    },
    [data]
  );

  const getFloor = useCallback(
    (idOrSlug: string) => {
      if (!data) return undefined;
      return data.floors.find((f) => f.id === idOrSlug || f.slug === idOrSlug);
    },
    [data]
  );

  const getDevicesForRoom = useCallback(
    (roomId: string) => {
      if (!data) return [];
      return data.devices.filter((d) => d.room_id === roomId).sort((a, b) => a.sort_order - b.sort_order);
    },
    [data]
  );

  const getCamerasForFloor = useCallback(
    (floorId?: string) => {
      if (!data) return [];
      if (!floorId) return data.cameras;
      return data.cameras.filter((c) => c.floor_id === floorId).sort((a, b) => a.sort_order - b.sort_order);
    },
    [data]
  );

  const getCamerasForRoom = useCallback(
    (roomId: string) => {
      if (!data) return [];
      return data.cameras
        .filter((c) => c.room_id === roomId)
        .sort((a, b) => a.sort_order - b.sort_order);
    },
    [data]
  );

  const getVirtualState = useCallback(
    (deviceId: string) => {
      if (!data || !data.virtual_device_states) return undefined;
      return data.virtual_device_states[deviceId];
    },
    [data]
  );

  const setVirtualState = useCallback(
    async (deviceId: string, state: any) => {
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          virtual_device_states: {
            ...prev.virtual_device_states,
            [deviceId]: state,
          },
        };
      });

      try {
        await ApiService.setVirtualState(deviceId, state);
      } catch (err) {
        console.warn('[BootstrapContext] setVirtualState failed:', err);
      }
    },
    []
  );

  const getZ2mState = useCallback(
    (friendlyNameOrKey: string) => {
      if (!friendlyNameOrKey) return undefined;
      let direct = z2mStates[friendlyNameOrKey];

      // Match corresponding IEEE or friendly name from z2mDevices
      const dev = z2mDevices.find(
        (d) =>
          d.friendly_name?.toLowerCase() === friendlyNameOrKey.toLowerCase() ||
          d.ieee_address?.toLowerCase() === friendlyNameOrKey.toLowerCase()
      );

      let altState: Record<string, any> | undefined;
      if (dev) {
        if (dev.ieee_address && z2mStates[dev.ieee_address]) {
          altState = { ...altState, ...z2mStates[dev.ieee_address] };
        }
        if (dev.friendly_name && z2mStates[dev.friendly_name]) {
          altState = { ...altState, ...z2mStates[dev.friendly_name] };
        }
      }

      // Case-insensitive fallback
      if (!direct && !altState) {
        const foundKey = Object.keys(z2mStates).find(
          (k) => k.toLowerCase() === friendlyNameOrKey.toLowerCase()
        );
        if (foundKey) direct = z2mStates[foundKey];
      }

      if (direct || altState) {
        return { ...(altState || {}), ...(direct || {}) };
      }
      return undefined;
    },
    [z2mStates, z2mDevices]
  );

  const getZ2mDevice = useCallback(
    (friendlyNameOrIeee: string) => {
      return z2mDevices.find(
        (d) => d.friendly_name === friendlyNameOrIeee || d.ieee_address === friendlyNameOrIeee
      );
    },
    [z2mDevices]
  );

  const setZ2mState = useCallback(
    async (friendlyName: string, state: Record<string, any>) => {
      setZ2mStates((prev) => ({
        ...prev,
        [friendlyName]: { ...prev[friendlyName], ...state },
      }));
      try {
        const res = await ApiService.setZ2mDeviceState(friendlyName, state);
        return res.ok;
      } catch (err) {
        console.warn('[BootstrapContext] setZ2mState failed:', err);
        return false;
      }
    },
    []
  );

  const getTuyaState = useCallback(
    (deviceId: string) => {
      return tuyaStates[deviceId];
    },
    [tuyaStates]
  );

  const getTuyaDevice = useCallback(
    (deviceId: string) => {
      return tuyaDevices.find((d) => d.id === deviceId);
    },
    [tuyaDevices]
  );

  const setTuyaState = useCallback(
    async (deviceId: string, state: Record<string, any>) => {
      setTuyaStates((prev) => ({
        ...prev,
        [deviceId]: { ...prev[deviceId], ...state },
      }));
      try {
        const res = await ApiService.setTuyaDeviceState(deviceId, state);
        return res.ok;
      } catch (err) {
        console.warn('[BootstrapContext] setTuyaState failed:', err);
        return false;
      }
    },
    []
  );

  return (
    <BootstrapContext.Provider
      value={{
        data,
        loading,
        refreshBootstrap: fetchBootstrap,
        getRoom,
        getFloor,
        getDevicesForRoom,
        getCamerasForFloor,
        getCamerasForRoom,
        getVirtualState,
        setVirtualState,
        isLiveSyncConnected,
        z2mStatus,
        z2mStates,
        z2mDevices,
        getZ2mState,
        setZ2mState,
        getZ2mDevice,
        tuyaStatus,
        tuyaStates,
        tuyaDevices,
        getTuyaState,
        setTuyaState,
        getTuyaDevice,
      }}
    >
      {children}
    </BootstrapContext.Provider>
  );
};

export const useBootstrap = () => {
  const context = useContext(BootstrapContext);
  if (!context) throw new Error('useBootstrap must be used within a BootstrapProvider');
  return context;
};
