export const requireApprovedCompanion = (req, res, next) => {
  const c = req.companion;
  if (!c) {
    return res.status(403).json({ message: 'Không tìm thấy hồ sơ companion.' });
  }
  if (c.status !== 'APPROVED') {
    return res.status(403).json({
      message:
        c.status === 'PENDING'
          ? 'Hồ sơ companion đang chờ admin duyệt.'
          : 'Hồ sơ companion chưa được duyệt.',
    });
  }
  next();
};

