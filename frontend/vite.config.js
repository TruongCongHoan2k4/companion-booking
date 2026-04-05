import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Lấy origin backend từ VITE_API_URL (vd: http://localhost:3000/api → http://localhost:3000). */
function proxyTargetFromEnv(env) {
  const raw = env.VITE_API_URL || 'http://localhost:3000/api';
  try {
    const u = new URL(raw);
    return `${u.protocol}//${u.host}`;
  } catch {
    return 'http://localhost:3000';
  }
}

function proxyConfig(target) {
  return {
    '/api': { target, changeOrigin: true },
    '/socket.io': { target, ws: true, changeOrigin: true },
    '/ws': { target, ws: true, changeOrigin: true },
    '/logout': { target, changeOrigin: true },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const target = proxyTargetFromEnv(env);
  const proxy = proxyConfig(target);

  return {
    plugins: [react()],
    root: __dirname,
    publicDir: false,
    server: {
      port: 5173,
      strictPort: false,
      proxy,
    },
    preview: {
      port: 4173,
      strictPort: false,
      proxy,
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: path.resolve(__dirname, 'auth.html'),
      },
    },
  };
});
