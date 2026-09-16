import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Demo mode is chosen at runtime (lib/runtimeMode). A production bundle without a Firebase
  // configuration can only run the local demo, so fail loudly instead of shipping it by accident.
  const hasConfigFile = fs.existsSync(path.resolve(__dirname, 'firebase-applet-config.json'));
  const hasEnvConfig = !!(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_APP_ID);
  if (mode === 'production' && !hasConfigFile && !hasEnvConfig && env.VITE_ALLOW_MOCK_BUILD !== 'true') {
    throw new Error(
      'Production build has no Firebase configuration. Set VITE_FIREBASE_API_KEY, VITE_FIREBASE_PROJECT_ID and ' +
      'VITE_FIREBASE_APP_ID (see .env.example), or set VITE_ALLOW_MOCK_BUILD=true for a demo-only build.'
    );
  }

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
    build: {
      sourcemap: false,
    },
    server: {
      // HMR can be disabled via DISABLE_HMR (used by some hosted editors).
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
