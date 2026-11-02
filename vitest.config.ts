import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    env: {
      VITE_SHEETS_WEBAPP_URL: 'https://script.example.com/macros/s/TEST_ID/exec',
    },
    setupFiles: ['./src/__tests__/unit/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
