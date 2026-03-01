import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      // API Key is no longer injected into the frontend bundle.
      // The frontend uses ephemeral tokens from /api/live-token instead.
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      allowedHosts: ["aiinterviewer.dahuangweb.xx.kg"],
    },
    preview: {
      port: 5201,
      strictPort: true,
      allowedHosts: ["aiinterviewer.dahuangweb.xx.kg"],
    },
  };
});
