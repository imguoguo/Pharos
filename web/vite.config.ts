import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue()],
  root: resolve(__dirname),
  resolve: {
    alias: {
      '@web': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:2468',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:2468',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: resolve(__dirname, '../dist/public'),
    emptyOutDir: true,
  },
});
