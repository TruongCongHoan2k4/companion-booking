import Companion from '../models/companion.model.js';

export const requireCompanion = async (req, res, next) => {
  try {
    if (req.auth?.role !== 'COMPANION') {
      return res.status(403).json({ message: 'Chỉ tài khoản companion mới dùng được API này.' });
    }

    const companion = await Companion.findOne({ user: req.auth.userId });
    if (!companion) {
      return res.status(403).json({ message: 'Không tìm thấy hồ sơ companion.' });
    }
    if (companion.status !== 'APPROVED') {
      return res.status(403).json({
        message:
          companion.status === 'PENDING'
            ? 'Hồ sơ companion đang chờ admin duyệt.'
            : 'Hồ sơ companion chưa được duyệt.',
      });
    }

    req.companion = companion;
    next();
  } catch (err) {
    res.status(500).json({ message: err.message || 'Không tải được hồ sơ companion.' });
  }
};
