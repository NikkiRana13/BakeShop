import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Runs the React Native app in the browser through react-native-web.
const extensions = [
  '.web.tsx',
  '.web.ts',
  '.web.mjs',
  '.web.js',
  '.tsx',
  '.ts',
  '.mjs',
  '.js',
  '.jsx',
  '.json',
];
const alias = [{ find: /^react-native$/, replacement: 'react-native-web' }];

export default defineConfig({
  root: 'web',
  plugins: [react()],
  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
    global: 'globalThis',
  },
  resolve: { alias, extensions },
  optimizeDeps: {
    // The pre-bundler needs the same web-first resolution as the app.
    rolldownOptions: { resolve: { alias: { 'react-native': 'react-native-web' }, extensions } },
  },
  build: { outDir: '../dist-web', emptyOutDir: true },
  server: { port: 5173 },
});
