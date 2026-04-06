import { defineConfig, loadEnv } from 'vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Origin backend từ VITE_API_URL (vd: http://localhost:3000/api → http://localhost:3000). */
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
    // Ảnh/video upload được backend serve dưới /uploads (khi không dùng Cloudinary).
    // Dev server cần proxy để <img src="/uploads/..."> hoạt động trên origin Vite.
    '/uploads': { target, changeOrigin: true },
    '/socket.io': { target, ws: true, changeOrigin: true },
    '/ws': { target, ws: true, changeOrigin: true },
    '/logout': { target, changeOrigin: true },
  };
}

/** Dev server + preview cho site HTML/JS tĩnh; không bundle SPA. */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');
  const target = proxyTargetFromEnv(env);
  const proxy = proxyConfig(target);

  return {
    root: __dirname,
    publicDir: false,
    server: {
      host: true,
      port: 5173,
      strictPort: false,
      proxy,
    },
    preview: {
      host: true,
      port: 4173,
      strictPort: false,
      proxy,
    },
  };
});
