import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { apiRoutes } from './server/vitePlugin';

export default defineConfig(({ mode }) => {
  // Make .env / .env.local available to the /api handlers in dev and preview.
  const fileEnv = loadEnv(mode, process.cwd(), '');
  for (const [k, v] of Object.entries(fileEnv)) process.env[k] ??= v;

  return {
    plugins: [react(), apiRoutes()],
    // Public values the browser needs (never secrets). Same env var names as the server.
    define: {
      __SUPABASE_URL__: JSON.stringify(process.env.SUPABASE_URL ?? ''),
      __SUPABASE_ANON_KEY__: JSON.stringify(process.env.SUPABASE_ANON_KEY ?? ''),
      __SITE_URL__: JSON.stringify(process.env.SITE_URL ?? ''),
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            motion: ['framer-motion'],
            charts: ['recharts'],
            supabase: ['@supabase/supabase-js'],
          },
        },
      },
    },
  };
});
