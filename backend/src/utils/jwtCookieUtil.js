/** Chuyển chuỗi expiresIn của JWT (vd: 15m, 7d) sang maxAge cookie (ms). */
export function expiresInToMs(expiresIn) {
  if (!expiresIn || typeof expiresIn !== 'string') return 15 * 60 * 1000;
  const m = /^(\d+)([smhd])$/i.exec(expiresIn.trim());
  if (!m) return 15 * 60 * 1000;
  const n = Number(m[1]);
  const unit = m[2].toLowerCase();
  const map = { s: 1000, m: 60 * 1000, h: 60 * 60 * 1000, d: 24 * 60 * 60 * 1000 };
  return n * (map[unit] ?? 60 * 1000);
}
