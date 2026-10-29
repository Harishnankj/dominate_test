import { WebSocket, WebSocketServer } from 'ws';
import type { IncomingMessage } from 'http';

export class LiveSyncManager {
  private wss: WebSocketServer | null = null;
  private clients: Set<WebSocket> = new Set();

  public init(wss: WebSocketServer) {
    this.wss = wss;
    this.wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
      this.clients.add(ws);

      // Send initial welcome
      ws.send(JSON.stringify({ type: 'connected', time: new Date().toISOString() }));

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });

      ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'ping') {
            ws.send(JSON.stringify({ type: 'pong' }));
          }
        } catch (_) {}
      });
    });
  }

  public broadcast(type: string, payload?: any) {
    const message = JSON.stringify({
      type,
      payload,
      timestamp: Date.now(),
    });

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
}

export const liveSync = new LiveSyncManager();
