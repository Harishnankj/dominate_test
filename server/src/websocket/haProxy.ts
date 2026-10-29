import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';
import { db } from '../db/index.js';

interface HubRow {
  id: string;
  name: string;
  local_url: string;
  cloud_url: string;
  access_token: string;
  enabled: number;
}

export function setupHaWebSocketProxy(server: any) {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket: any, head: any) => {
    const url = request.url || '';
    if (url.startsWith('/ha-ws/')) {
      const parts = url.split('?')[0].split('/');
      const hubId = parts[2];

      if (!hubId) {
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        handleHaProxyConnection(ws, hubId);
      });
    }
  });
}

function handleHaProxyConnection(clientWs: WebSocket, hubId: string) {
  const hub = db.prepare('SELECT * FROM ha_hubs WHERE id = ?').get(hubId) as HubRow | undefined;
  if (!hub || !hub.enabled) {
    clientWs.send(JSON.stringify({ type: 'error', message: `Home Assistant Hub ${hubId} not found or disabled` }));
    clientWs.close();
    return;
  }

  // Determine target WS URL from local_url
  let targetWsUrl = hub.local_url.replace(/^http:\/\//, 'ws://').replace(/^https:\/\//, 'wss://');
  if (!targetWsUrl.endsWith('/api/websocket')) {
    targetWsUrl = targetWsUrl.replace(/\/+$/, '') + '/api/websocket';
  }

  let haWs: WebSocket | null = null;
  const pendingQueue: any[] = [];

  try {
    haWs = new WebSocket(targetWsUrl, {
      rejectUnauthorized: false, // allow self-signed local certs
    });

    haWs.on('open', () => {
      // Flush pending queue
      while (pendingQueue.length > 0) {
        const item = pendingQueue.shift();
        if (haWs && haWs.readyState === WebSocket.OPEN) {
          haWs.send(item);
        }
      }
    });

    haWs.on('message', (data, isBinary) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(data, { binary: isBinary });
      }
    });

    haWs.on('close', (code, reason) => {
      if (clientWs.readyState === WebSocket.OPEN) {
        try {
          const validCode = typeof code === 'number' && code >= 1000 && code <= 4999 ? code : 1000;
          clientWs.close(validCode, reason ? reason.toString() : undefined);
        } catch (_) {
          try { clientWs.close(); } catch (_) {}
        }
      }
    });

    haWs.on('error', (err) => {
      console.warn(`[HaProxy] Error connecting to HA (${targetWsUrl}):`, err.message);
      if (clientWs.readyState === WebSocket.OPEN) {
        try {
          clientWs.send(JSON.stringify({ type: 'ha_proxy_error', error: err.message }));
        } catch (_) {}
      }
    });
  } catch (err: any) {
    console.error(`[HaProxy] Fatal proxy error for hub ${hubId}:`, err);
    try {
      clientWs.close(1011, err.message);
    } catch (_) {
      try { clientWs.close(); } catch (_) {}
    }
    return;
  }

  clientWs.on('message', (data, isBinary) => {
    try {
      if (!isBinary) {
        const text = data.toString();
        const msg = JSON.parse(text);
        if (msg.type === 'auth' && (!msg.access_token || msg.access_token === 'undefined')) {
          msg.access_token = hub.access_token;
          const injected = Buffer.from(JSON.stringify(msg));
          if (haWs && haWs.readyState === WebSocket.OPEN) {
            haWs.send(injected);
          } else {
            pendingQueue.push(injected);
          }
          return;
        }
      }
    } catch (_) {}

    if (haWs && haWs.readyState === WebSocket.OPEN) {
      haWs.send(data, { binary: isBinary });
    } else {
      pendingQueue.push(data);
    }
  });

  clientWs.on('close', () => {
    if (haWs && haWs.readyState === WebSocket.OPEN) {
      haWs.close();
    }
  });

  clientWs.on('error', () => {
    if (haWs) {
      try { haWs.close(); } catch (_) {}
    }
  });
}
