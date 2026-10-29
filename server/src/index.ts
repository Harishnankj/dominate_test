import http from 'http';
import path from 'path';
import fs from 'fs';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { WebSocketServer } from 'ws';

import { initDatabase } from './db/index.js';
import { liveSync } from './websocket/liveSync.js';
import { setupHaWebSocketProxy } from './websocket/haProxy.js';
import { automationScheduler } from './scheduler.js';

import authRouter from './routes/auth.js';
import bootstrapRouter from './routes/bootstrap.js';
import adminRouter from './routes/admin.js';
import devicesRouter from './routes/devices.js';
import automationsRouter from './routes/automations.js';
import hrRouter from './routes/hr.js';
import miscRouter from './routes/misc.js';
import z2mRouter from './routes/z2m.js';
import { mqttService } from './services/mqttService.js';

// 1. Initialize SQLite Database
initDatabase();

// 2. Initialize Express
const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// 3. Register REST API Routes
app.use('/api/auth', authRouter);
app.use('/api/bootstrap', bootstrapRouter);
app.use('/api/admin', adminRouter);
app.use('/api/devices', devicesRouter);
app.use('/api/automations', automationsRouter);
app.use('/api/hr', hrRouter);
app.use('/api/z2m', z2mRouter);
app.use('/api', miscRouter);

// 4. Serve Client static bundle in production if available
const clientDist = path.resolve(process.cwd(), '../client/dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api') || req.url.startsWith('/ha-ws') || req.url.startsWith('/live-sync')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// 5. Create HTTP Server
const server = http.createServer(app);

// 6. Setup WebSockets
// A. WebSocket Live Sync Server (/api/live-sync)
const liveSyncWss = new WebSocketServer({ noServer: true });
liveSync.init(liveSyncWss);

// B. Home Assistant WebSocket Proxy (/ha-ws/:hubId)
setupHaWebSocketProxy(server);

// Central upgrade handler for non-ha-ws upgrades
server.on('upgrade', (request, socket, head) => {
  const pathname = request.url?.split('?')[0];
  if (pathname === '/api/live-sync' || pathname === '/live-sync') {
    liveSyncWss.handleUpgrade(request, socket, head, (ws) => {
      liveSyncWss.emit('connection', ws, request);
    });
  }
});

// 7. Start in-process 1-minute node-cron automation scheduler
automationScheduler.start();

// 8. Initialize Zigbee2MQTT / MQTT client
mqttService.init();

process.on('uncaughtException', (err) => {
  console.warn('[SERVER] Caught unhandled exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.warn('[SERVER] Caught unhandled rejection:', reason);
});

// 8. Listen
server.listen(PORT, () => {
  console.log(`[DOMINATEE SERVER] Running on port ${PORT}`);
  console.log(`[DOMINATEE SERVER] Live Sync WebSocket ready at /api/live-sync`);
  console.log(`[DOMINATEE SERVER] HA Proxy WebSocket ready at /ha-ws/:hubId`);
});
