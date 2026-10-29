import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { BootstrapData, Floor, Room, Device, Camera, IrProfile, Automation, Z2mStatus } from '../types';
import { ApiService } from '../services/api';

interface BootstrapContextType {
  data: BootstrapData | null;
  loading: boolean;
  refreshBootstrap: () => Promise<void>;
  getRoom: (idOrSlug: string) => Room | undefined;
  getFloor: (idOrSlug: string) => Floor | undefined;
  getDevicesForRoom: (roomId: string) => Device[];
  getCamerasForFloor: (floorId?: string) => Camera[];
  getVirtualState: (deviceId: string) => any;
  setVirtualState: (deviceId: string, state: any) => Promise<void>;
  isLiveSyncConnected: boolean;
  z2mStatus: Z2mStatus | null;
  z2mStates: Record<string, any>;
  getZ2mState: (friendlyName: string) => Record<string, any> | undefined;
  setZ2mState: (friendlyName: string, state: Record<string, any>) => Promise<boolean>;
}

const BootstrapContext = createContext<BootstrapContextType | undefined>(undefined);

export const BootstrapProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLiveSyncConnected, setIsLiveSyncConnected] = useState(false);
  const [z2mStatus, setZ2mStatus] = useState<Z2mStatus | null>(null);
  const [z2mStates, setZ2mStates] = useState<Record<string, any>>({});

  const fetchBootstrap = useCallback(async () => {
    try {
      const res = await ApiService.getBootstrap();
      setData(res);
      if (res.z2m_status) {
        setZ2mStatus(res.z2m_status);
      }
    } catch (err) {
      console.warn('[BootstrapContext] Failed to load bootstrap:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBootstrap();
    // Load initial Zigbee2MQTT states
    ApiService.getZ2mStatus()
      .then((res) => {
        if (res.ok) {
          setZ2mStatus(res.status);
          setZ2mStates(res.states || {});
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
            } else if (msg.type === 'z2m_status_changed') {
              setZ2mStatus(msg.payload);
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

  const getVirtualState = useCallback(
    (deviceId: string) => {
      if (!data || !data.virtual_device_states) return undefined;
      return data.virtual_device_states[deviceId];
    },
    [data]
  );

  const setVirtualState = useCallback(
    async (deviceId: string, state: any) => {
      // Optimistically update local
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
    (friendlyName: string) => {
      return z2mStates[friendlyName];
    },
    [z2mStates]
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
        getVirtualState,
        setVirtualState,
        isLiveSyncConnected,
        z2mStatus,
        z2mStates,
        getZ2mState,
        setZ2mState,
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
