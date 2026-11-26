import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const apiProxyConfig = {
  '/api': {
    target: 'http://127.0.0.1:4174',
    changeOrigin: true,
    configure: (proxy: {
      on: (
        event: 'error',
        handler: (
          err: Error,
          req: unknown,
          res: { writeHead?: (code: number, headers: Record<string, string>) => void; headersSent?: boolean; end?: (body: string) => void }
        ) => void
      ) => void;
    }) => {
      proxy.on('error', (_err, _req, res) => {
        if (res && typeof res.writeHead === 'function' && !res.headersSent) {
          res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end?.(JSON.stringify({ ok: false, offline: true }));
        }
      });
    },
  },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react';
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons';
          }
        },
      },
    },
  },
  server: {
    proxy: apiProxyConfig,
  },
  preview: {
    proxy: apiProxyConfig,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    testTimeout: 15000,
  },
});
