import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Catch transient socket drops in dev mode so Vite dev server never exits
if (typeof process !== 'undefined') {
  process.on('uncaughtException', (err: any) => {
    if (
      err?.code === 'ECONNRESET' ||
      err?.code === 'EPIPE' ||
      err?.code === 'ETIMEDOUT' ||
      err?.code === 'ERR_STREAM_DESTROYED' ||
      err?.message?.includes('ECONNRESET') ||
      err?.message?.includes('socket')
    ) {
      return;
    }
    console.warn('[Vite uncaught exception]:', err);
  });
  process.on('unhandledRejection', () => {
    // Suppress transient unhandled rejections
  });
}

const handleProxyError = (proxy: any) => {
  proxy.on('error', () => {});
  proxy.on('proxyReqWs', (_proxyReq: any, _req: any, socket: any) => {
    socket.on('error', () => {});
  });
  proxy.on('open', (proxySocket: any) => {
    proxySocket.on('error', () => {});
  });
  proxy.on('close', () => {});
};

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api/ws': {
        target: 'http://127.0.0.1:1984',
        ws: true,
        changeOrigin: true,
        configure: handleProxyError,
      },
      '/api/streams': {
        target: 'http://127.0.0.1:1984',
        changeOrigin: true,
        configure: handleProxyError,
      },
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
        configure: handleProxyError,
      },
      '/ha-ws': {
        target: 'http://localhost:4000',
        ws: true,
        changeOrigin: true,
        configure: handleProxyError,
      },
      '/live-sync': {
        target: 'http://localhost:4000',
        ws: true,
        changeOrigin: true,
        configure: handleProxyError,
      },
    },
  },
});
