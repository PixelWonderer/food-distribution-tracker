import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  root: '.',
  base: './', // Use relative paths for assets
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false, // No sourcemaps in production
    target: 'es2015', // Support older Safari versions
    rollupOptions: {
      input: './index.html'
    }
  },
  resolve: {
    alias: {
      '@': path.resolve('./src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {}
    }
  }
});
