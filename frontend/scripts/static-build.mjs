/**
 * Sau `vite build` (bundle auth.html → dist), copy site tĩnh (HTML + public + pages) vào dist (merge).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

const toCopy = ['pages', 'public', 'index.html', 'policy.html'];

fs.mkdirSync(dist, { recursive: true });

for (const name of toCopy) {
  const src = path.join(root, name);
  if (!fs.existsSync(src)) continue;
  const dest = path.join(dist, name);
  const st = fs.statSync(src);
  if (st.isDirectory()) {
    fs.cpSync(src, dest, { recursive: true });
  } else {
    fs.copyFileSync(src, dest);
  }
}

console.log('static-build: merged static assets into', dist);
