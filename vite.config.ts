import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import fs from 'fs';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');

  const hasRealFirebase = fs.existsSync(path.resolve(__dirname, './firebase-applet-config.json')) || 
    !!env.VITE_FIREBASE_API_KEY || 
    !!env.FIREBASE_API_KEY;

  const aliases: Record<string, string> = {
    '@': path.resolve(__dirname, '.'),
  };

  if (!hasRealFirebase) {
    console.log("No real Firebase configuration detected. Using local mock fallback.");
    aliases['firebase/app'] = path.resolve(__dirname, './src/mockFirebase.ts');
    aliases['firebase/auth'] = path.resolve(__dirname, './src/mockFirebase.ts');
    aliases['firebase/firestore'] = path.resolve(__dirname, './src/mockFirebase.ts');
  }

  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY || env.VITE_GEMINI_API_KEY),
    },
    resolve: {
      alias: aliases,
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
