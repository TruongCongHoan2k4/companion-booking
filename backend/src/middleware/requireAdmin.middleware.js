export const requireAdmin = (req, res, next) => {
  if (req.auth?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Chỉ quản trị viên mới truy cập được.' });
  }
  next();
};
