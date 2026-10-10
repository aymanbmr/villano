import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, /api and /uploads are forwarded to the NestJS server so the app
// can use relative URLs and avoid CORS entirely.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true, // listen on the LAN too, so a phone on the same Wi-Fi can reach it
    // Accept the host header of a tunnel: some routers isolate their clients
    // from each other, and the caisse then reaches the app through a public
    // address instead of the local network.
    allowedHosts: true,
    proxy: {
      '/api': 'http://localhost:3000',
      '/uploads': 'http://localhost:3000',
    },
  },
});
