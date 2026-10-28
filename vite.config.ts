import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { calendarSyncApi } from './server/vitePlugin';

export default defineConfig({
  plugins: [react(), calendarSyncApi()],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          motion: ['framer-motion'],
          charts: ['recharts'],
        },
      },
    },
  },
});
