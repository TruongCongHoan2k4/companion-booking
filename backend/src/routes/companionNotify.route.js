import express from 'express';
import { verifyToken } from '../middleware/verifyToken.middleware.js';
import { validateMongoIdParam } from '../middleware/mongoIdParam.middleware.js';
import * as adminActions from '../services/adminActions.service.js';

const router = express.Router();

function requireCompanionRole(req, res, next) {
  if (req.auth?.role !== 'COMPANION') {
    return res.status(403).json({ message: 'Chỉ tài khoản companion mới dùng được API này.' });
  }
  next();
}

router.use(verifyToken);
router.use(requireCompanionRole);

router.get('/notifications/me', async (req, res) => {
  try {
    const data = await adminActions.listAdminNotifications(req.auth.userId);
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Không tải được thông báo.' });
  }
});

router.patch('/notifications/:id/read', validateMongoIdParam('id'), async (req, res) => {
  try {
    await adminActions.markNotificationRead(req.auth.userId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Cập nhật thất bại.' });
  }
});

router.patch('/notifications/read-all', async (req, res) => {
  try {
    await adminActions.markAllNotificationsRead(req.auth.userId);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Cập nhật thất bại.' });
  }
});

export default router;
