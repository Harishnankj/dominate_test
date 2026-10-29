import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { HaHub, HaEntityState } from '../types';
import { useBootstrap } from './BootstrapContext';
import { applyOptimisticUpdate } from '../utils/haOptimistic';

interface HubConnectionState {
  hub: HaHub;
  isConnected: boolean;
  activeUrl: string;
  entities: Record<string, HaEntityState>;
  callService: (domain: string, service: string, serviceData?: Record<string, any>) => Promise<any>;
}

interface MultiHubContextType {
  hubs: Record<string, HubConnectionState>;
  primaryHubId: string | null;
  callService: (hubId: string | undefined | null, domain: string, service: string, serviceData?: Record<string, any>) => Promise<any>;
  getEntity: (entityId: string, hubId?: string | null) => HaEntityState | undefined;
}

const MultiHubContext = createContext<MultiHubContextType | undefined>(undefined);

export const MultiHubHomeAssistantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data } = useBootstrap();

  const hubsKey = useMemo(() => {
    return (data?.hubs || [])
      .map((h) => `${h.id}:${h.enabled}:${h.local_url}:${h.cloud_url}:${h.access_token}`)
      .join('|');
  }, [data?.hubs]);

  const enabledHubs = useMemo(() => {
    return (data?.hubs || []).filter((h) => h.enabled);
  }, [hubsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const primaryHubId = enabledHubs[0]?.id || null;

  const [entitiesByHub, setEntitiesByHub] = useState<Record<string, Record<string, HaEntityState>>>({});
  const [connectionStatusByHub, setConnectionStatusByHub] = useState<Record<string, { isConnected: boolean; activeUrl: string }>>({});

  const socketsRef = useRef<Record<string, WebSocket>>({});
  const messageIdRef = useRef<Record<string, number>>({});
  const pendingRequestsRef = useRef<Record<string, Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>>>({});

  // Connect to a single hub with URL racing
  const connectHub = useCallback((hub: HaHub) => {
    const hubId = hub.id;
    if (socketsRef.current[hubId]) {
      try { socketsRef.current[hubId].close(); } catch (_) {}
    }

    messageIdRef.current[hubId] = 1;
    pendingRequestsRef.current[hubId] = new Map();

    const isPageHttps = window.location.protocol === 'https:';
    const isLocalHttp = hub.local_url.startsWith('http://');

    // Build candidate WS URLs
    const proxyWsUrl = `${isPageHttps ? 'wss:' : 'ws:'}//${window.location.host}/ha-ws/${hubId}`;
    let localWsUrl = hub.local_url.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://').replace(/\/+$/, '') + '/api/websocket';
    let cloudWsUrl = hub.cloud_url ? hub.cloud_url.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://').replace(/\/+$/, '') + '/api/websocket' : null;

    // Mixed content protection: If page is HTTPS and local is HTTP, browser will block localWsUrl directly.
    // In that case, prioritize proxyWsUrl or HTTPS cloudWsUrl!
    let candidateUrls: string[] = [];
    if (isPageHttps && isLocalHttp) {
      candidateUrls = [proxyWsUrl, cloudWsUrl].filter(Boolean) as string[];
    } else {
      // Race local with 260ms head start
      candidateUrls = [localWsUrl, proxyWsUrl, cloudWsUrl].filter(Boolean) as string[];
    }

    let winnerSocket: WebSocket | null = null;
    let hasWon = false;

    candidateUrls.forEach((url, index) => {
      // 260ms head start for local URL
      const delay = index === 0 ? 0 : 260;

      setTimeout(() => {
        if (hasWon) return;

        try {
          const ws = new WebSocket(url);

          ws.onopen = () => {
            // Wait for auth_required message
          };

          ws.onmessage = (event) => {
            try {
              const msg = JSON.parse(event.data);

              if (msg.type === 'auth_required') {
                ws.send(JSON.stringify({ type: 'auth', access_token: hub.access_token }));
              } else if (msg.type === 'auth_ok') {
                if (!hasWon) {
                  hasWon = true;
                  winnerSocket = ws;
                  socketsRef.current[hubId] = ws;

                  setConnectionStatusByHub((prev) => ({
                    ...prev,
                    [hubId]: { isConnected: true, activeUrl: url },
                  }));

                  // 1. Fetch initial states
                  const statesReqId = messageIdRef.current[hubId]++;
                  ws.send(JSON.stringify({ id: statesReqId, type: 'get_states' }));

                  // 2. Subscribe to live push updates
                  const subReqId = messageIdRef.current[hubId]++;
                  ws.send(JSON.stringify({ id: subReqId, type: 'subscribe_events', event_type: 'state_changed' }));
                }
              } else if (msg.type === 'result') {
                if (Array.isArray(msg.result)) {
                  // This is the get_states response
                  const map: Record<string, HaEntityState> = {};
                  for (const ent of msg.result) {
                    if (ent.entity_id) {
                      map[ent.entity_id] = {
                        entity_id: ent.entity_id,
                        state: ent.state,
                        attributes: ent.attributes || {},
                        last_changed: ent.last_changed,
                        last_updated: ent.last_updated,
                      };
                    }
                  }
                  setEntitiesByHub((prev) => ({ ...prev, [hubId]: map }));
                }

                // Resolve any pending request
                const pending = pendingRequestsRef.current[hubId]?.get(msg.id);
                if (pending) {
                  if (msg.success) {
                    pending.resolve(msg.result);
                  } else {
                    pending.reject(new Error(msg.error?.message || 'HA call failed'));
                  }
                  pendingRequestsRef.current[hubId]?.delete(msg.id);
                }
              } else if (msg.type === 'event' && msg.event?.event_type === 'state_changed') {
                const { entity_id, new_state } = msg.event.data || {};
                if (entity_id && new_state) {
                  setEntitiesByHub((prev) => {
                    const currentHubMap = prev[hubId] || {};
                    return {
                      ...prev,
                      [hubId]: {
                        ...currentHubMap,
                        [entity_id]: {
                          entity_id,
                          state: new_state.state,
                          attributes: new_state.attributes || {},
                          last_changed: new_state.last_changed,
                          last_updated: new_state.last_updated,
                        },
                      },
                    };
                  });
                }
              }
            } catch (e) {
              console.warn('[HA WS] Message parse error:', e);
            }
          };

          ws.onerror = () => {
            if (winnerSocket === ws) {
              setConnectionStatusByHub((prev) => ({
                ...prev,
                [hubId]: { isConnected: false, activeUrl: '' },
              }));
            }
          };

          ws.onclose = () => {
            if (winnerSocket === ws) {
              setConnectionStatusByHub((prev) => ({
                ...prev,
                [hubId]: { isConnected: false, activeUrl: '' },
              }));
              delete socketsRef.current[hubId];
              // Reconnect after 3s
              setTimeout(() => connectHub(hub), 3000);
            }
          };
        } catch (_) {}
      }, delay);
    });
  }, []);

  // Connect to all enabled hubs
  useEffect(() => {
    enabledHubs.forEach((hub) => {
      connectHub(hub);
    });

    return () => {
      Object.values(socketsRef.current).forEach((ws) => {
        try { ws.close(); } catch (_) {}
      });
      socketsRef.current = {};
    };
  }, [enabledHubs, connectHub]);

  // Central callService with optimistic UI updates
  const callService = useCallback(
    async (targetHubId: string | undefined | null, domain: string, service: string, serviceData: Record<string, any> = {}) => {
      const resolvedHubId = targetHubId || primaryHubId;
      if (!resolvedHubId) {
        throw new Error('No Home Assistant hub available');
      }

      const entityId = serviceData.entity_id;

      // 0ms Optimistic UI update
      if (entityId) {
        setEntitiesByHub((prev) => {
          const hubEntities = prev[resolvedHubId] || {};
          const currentEntity = hubEntities[entityId];
          const updated = applyOptimisticUpdate(currentEntity, domain, service, serviceData);
          return {
            ...prev,
            [resolvedHubId]: {
              ...hubEntities,
              [entityId]: updated,
            },
          };
        });
      }

      const ws = socketsRef.current[resolvedHubId];
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        // Fallback to server relay /api/devices/ha-call
        try {
          const res = await fetch('/api/devices/ha-call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              hub_id: resolvedHubId,
              domain,
              service,
              service_data: serviceData,
            }),
          });
          if (res.ok) {
            const data = await res.json();
            return data.result;
          }
        } catch (_) {}

        // Fallback to direct REST API
        const targetHub = enabledHubs.find((h) => h.id === resolvedHubId);
        if (targetHub && targetHub.access_token) {
          const res = await fetch(`${targetHub.local_url.replace(/\/+$/, '')}/api/services/${domain}/${service}`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${targetHub.access_token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(serviceData),
          });
          return res.json();
        }
        throw new Error(`Hub ${resolvedHubId} is not connected`);
      }

      const reqId = messageIdRef.current[resolvedHubId]++;
      return new Promise((resolve, reject) => {
        pendingRequestsRef.current[resolvedHubId]?.set(reqId, { resolve, reject });
        ws.send(
          JSON.stringify({
            id: reqId,
            type: 'call_service',
            domain,
            service,
            service_data: serviceData,
          })
        );

        // 5s timeout -> fallback to server proxy
        setTimeout(async () => {
          if (pendingRequestsRef.current[resolvedHubId]?.has(reqId)) {
            pendingRequestsRef.current[resolvedHubId]?.delete(reqId);
            try {
              const res = await fetch('/api/devices/ha-call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  hub_id: resolvedHubId,
                  domain,
                  service,
                  service_data: serviceData,
                }),
              });
              if (res.ok) {
                const data = await res.json();
                resolve(data.result);
                return;
              }
            } catch (_) {}
            reject(new Error(`HA service call timeout (${domain}.${service})`));
          }
        }, 5000);
      });
    },
    [primaryHubId, enabledHubs]
  );

  const getEntity = useCallback(
    (entityId: string, targetHubId?: string | null): HaEntityState | undefined => {
      if (!entityId) return undefined;
      if (targetHubId && entitiesByHub[targetHubId]) {
        return entitiesByHub[targetHubId][entityId];
      }
      // Search across all hubs
      for (const hubEntities of Object.values(entitiesByHub)) {
        if (hubEntities[entityId]) return hubEntities[entityId];
      }
      return undefined;
    },
    [entitiesByHub]
  );

  // Construct hubs map for consumer
  const hubsMap: Record<string, HubConnectionState> = {};
  for (const hub of enabledHubs) {
    const status = connectionStatusByHub[hub.id] || { isConnected: false, activeUrl: '' };
    hubsMap[hub.id] = {
      hub,
      isConnected: status.isConnected,
      activeUrl: status.activeUrl,
      entities: entitiesByHub[hub.id] || {},
      callService: (domain, service, data) => callService(hub.id, domain, service, data),
    };
  }

  return (
    <MultiHubContext.Provider
      value={{
        hubs: hubsMap,
        primaryHubId,
        callService,
        getEntity,
      }}
    >
      {children}
    </MultiHubContext.Provider>
  );
};

export const useHA = (hubId?: string | null) => {
  const context = useContext(MultiHubContext);
  if (!context) throw new Error('useHA must be used within a MultiHubHomeAssistantProvider');

  const resolvedHubId = hubId || context.primaryHubId;
  const hubConnection = resolvedHubId ? context.hubs[resolvedHubId] : undefined;

  return {
    isConnected: hubConnection?.isConnected ?? false,
    activeUrl: hubConnection?.activeUrl ?? '',
    entities: hubConnection?.entities ?? {},
    callService: (domain: string, service: string, data?: Record<string, any>) =>
      context.callService(resolvedHubId, domain, service, data),
    getEntity: (id: string) => context.getEntity(id, resolvedHubId),
    hubs: context.hubs,
  };
};

export const useEntity = (entityId?: string | null, hubId?: string | null) => {
  const context = useContext(MultiHubContext);
  if (!context) throw new Error('useEntity must be used within a MultiHubHomeAssistantProvider');

  const entity = entityId ? context.getEntity(entityId, hubId) : undefined;

  const callEntityService = useCallback(
    (domain: string, service: string, extraData?: Record<string, any>) => {
      if (!entityId) return Promise.reject(new Error('No entity ID'));
      return context.callService(hubId, domain, service, { entity_id: entityId, ...(extraData || {}) });
    },
    [context, entityId, hubId]
  );

  return {
    entity,
    state: entity?.state ?? 'unavailable',
    attributes: entity?.attributes ?? {},
    callService: callEntityService,
  };
};
