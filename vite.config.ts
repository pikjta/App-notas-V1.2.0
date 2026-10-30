import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Puerto fijo que espera Tauri (tauri.conf.json → devUrl).
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true, watch: { ignored: ['**/src-tauri/**', '**/crates/**'] } },
  build: { target: 'es2021', sourcemap: false },
  test: { environment: 'node', setupFiles: ['./src/__tests__/setup.ts'] },
});
