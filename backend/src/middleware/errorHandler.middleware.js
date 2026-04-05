/**
 * Middleware xử lý lỗi cuối cùng — tránh crash không trả response.
 */
export function errorHandler(err, req, res, next) {
  console.error('[error]', err?.stack || err?.message || err);
  if (res.headersSent) {
    return next(err);
  }
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Lỗi máy chủ.' });
}
