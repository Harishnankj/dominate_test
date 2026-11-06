import https from 'node:https';
import http from 'node:http';
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Mobile Secure Context Gateway (HTTPS -> HTTP Proxy)
 * 
 * Allows phones, tablets, and remote LAN devices to connect over HTTPS (port 5174)
 * so that mobile browsers grant microphone permissions (getUserMedia & Web Speech API).
 * Desktop PCs connect directly to Vite on plain HTTP (port 5173) with zero SSL friction.
 */
export function startHttpsGateway(httpsPort = 5174, targetPort = 5173) {
  try {
    const candidateCertPaths = [
      path.resolve(process.cwd(), '../client/node_modules/.vite/basic-ssl/_cert.pem'),
      path.resolve(process.cwd(), 'client/node_modules/.vite/basic-ssl/_cert.pem'),
      path.resolve(process.cwd(), 'node_modules/.vite/basic-ssl/_cert.pem'),
    ];

    let foundCert: string | null = null;
    for (const p of candidateCertPaths) {
      if (fs.existsSync(p)) {
        foundCert = p;
        break;
      }
    }

    if (!foundCert) {
      console.log('[HTTPS GATEWAY] SSL certificate not found, skipping mobile HTTPS gateway.');
      return;
    }

    const certContent = fs.readFileSync(foundCert, 'utf8');
    const proxyServer = https.createServer(
      {
        key: certContent,
        cert: certContent,
      },
      (req, res) => {
        const proxyReq = http.request(
          {
            hostname: '127.0.0.1',
            port: targetPort,
            path: req.url,
            method: req.method,
            headers: {
              ...req.headers,
              'x-forwarded-proto': 'https',
              'x-forwarded-host': req.headers.host,
            },
          },
          (proxyRes) => {
            res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
            proxyRes.pipe(res, { end: true });
          }
        );

        proxyReq.on('error', () => {
          if (!res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end('DOMINATEE OS client is starting up on port ' + targetPort + '...');
          }
        });

        req.pipe(proxyReq, { end: true });
      }
    );

    // Proxy WebSocket upgrades (Vite HMR, HA WS, Live Sync WS)
    proxyServer.on('upgrade', (req, socket, head) => {
      const proxySocket = net.connect(targetPort, '127.0.0.1', () => {
        let rawHeaders = `${req.method} ${req.url} HTTP/${req.httpVersion}\r\n`;
        for (const [key, value] of Object.entries(req.headers)) {
          if (Array.isArray(value)) {
            for (const v of value) rawHeaders += `${key}: ${v}\r\n`;
          } else if (value !== undefined) {
            rawHeaders += `${key}: ${value}\r\n`;
          }
        }
        rawHeaders += '\r\n';

        proxySocket.write(rawHeaders);
        if (head && head.length > 0) {
          proxySocket.write(head);
        }
        proxySocket.pipe(socket);
        socket.pipe(proxySocket);
      });

      proxySocket.on('error', () => {
        socket.destroy();
      });
      socket.on('error', () => {
        proxySocket.destroy();
      });
    });

    proxyServer.listen(httpsPort, '0.0.0.0', () => {
      console.log(`[HTTPS GATEWAY] Mobile HTTPS Gateway listening on https://0.0.0.0:${httpsPort} (proxying to HTTP :${targetPort})`);
    });
  } catch (err: any) {
    console.warn('[HTTPS GATEWAY] Failed to initialize:', err.message);
  }
}

