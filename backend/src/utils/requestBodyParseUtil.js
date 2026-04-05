// requestBodyParseUtil.js

/**
 * Đọc giá trị kiểu Number từ object, trả về Number hoặc null nếu không hợp lệ
 * @param {Object} obj
 * @param {string} key
 * @returns {number|null}
 */
export function readDouble(obj, key) {
  if (!obj) return null;
  const v = obj[key];
  if (v == null) return null;

  if (typeof v === 'number') return v;
  if (typeof v === 'string' && v.trim()) {
    const parsed = parseFloat(v.trim());
    return isNaN(parsed) ? null : parsed;
  }
  return null;
}

/**
 * Đọc giá trị kiểu String từ object, trả về defaultValue hoặc "" nếu không tồn tại
 * @param {Object} obj
 * @param {string} key
 * @param {string} [defaultValue=""]
 * @returns {string}
 */
export function readString(obj, key, defaultValue = '') {
  if (!obj || obj[key] == null) return defaultValue ?? '';
  return String(obj[key]);
}
