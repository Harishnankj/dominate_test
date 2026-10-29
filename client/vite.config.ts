import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
      },
      '/api/streams': {
        target: 'http://127.0.0.1:1984',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:4000',
        changeOrigin: true,
      },
      '/ha-ws': {
        target: 'http://localhost:4000',
        ws: true,
        changeOrigin: true,
      },
      '/live-sync': {
        target: 'http://localhost:4000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
