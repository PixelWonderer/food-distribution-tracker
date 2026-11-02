import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';
import { portalApiPlugin } from './vite-plugins/portal-api';

// Custom plugin to remove crossorigin attribute for Safari compatibility
const removeCrossOriginPlugin = () => {
  return {
    name: 'remove-crossorigin',
    transformIndexHtml(html) {
      // Remove crossorigin attribute from script tags
      return html.replace(/(<script[^>]*)\s+crossorigin(?:="[^"]*")?([^>]*>)/gi, '$1$2');
    }
  };
};

export default defineConfig({
  root: '.',
  base: '/', // Absolute paths required for service worker scope
  plugins: [
    react(),
    removeCrossOriginPlugin(),
    portalApiPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: false, // Use existing public/manifest.json
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico}'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/door/, /^\/api/],
        // Do NOT cache Supabase API calls — data caching handled at app layer
        runtimeCaching: [],
      },
    }),
  ],
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2015', // Support older Safari versions
    rollupOptions: {
      input: './index.html',
      output: {
        format: 'es',
        // Remove crossorigin attribute from script tags
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    },
    // Ensure proper polyfills and transpilation
    commonjsOptions: {
      transformMixedEsModules: true
    }
  },
  server: {
    port: 3000,
    open: true
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {}
    }
  }
});
