// Menambahkan tipe opsi `test` (Vitest) ke `defineConfig` tanpa mengubah
// import runtime — vite.config.ts tetap hanya bergantung pada `vite` saat build.
/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
    build: {
      // Pisahkan dependensi berat ke chunk terpisah agar bundle utama lebih kecil
      // dan chunk vendor bisa di-cache browser lebih lama.
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            supabase: ['@supabase/supabase-js'],
            xlsx: ['xlsx'],
            docx: ['mammoth'],
            icons: ['lucide-react'],
            motion: ['motion/react'],
          },
        },
      },
    },

    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      host: '0.0.0.0',
      port: 3000,
      allowedHosts: true as const,
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
