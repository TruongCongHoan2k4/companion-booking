import express from 'express';
import { verifyToken } from '../middleware/verifyToken.middleware.js';
import { validateMongoIdParam } from '../middleware/mongoIdParam.middleware.js';
import Notification from '../models/notification.model.js';

const router = express.Router();

router.use(verifyToken);

router.get('/notifications/me', async (req, res) => {
  const list = await Notification.find({ user: req.auth.userId }).sort({ createdAt: -1 }).limit(200).lean();
  res.json(
    list.map((n) => ({
      id: String(n._id),
      title: n.title,
      content: n.content,
      isRead: Boolean(n.isRead),
      createdAt: n.createdAt,
    }))
  );
});

router.patch('/notifications/read-all', async (req, res) => {
  await Notification.updateMany({ user: req.auth.userId, isRead: false }, { $set: { isRead: true } });
  res.json({ ok: true });
});

router.patch('/notifications/:id/read', validateMongoIdParam('id'), async (req, res) => {
  await Notification.updateOne({ _id: req.params.id, user: req.auth.userId }, { $set: { isRead: true } });
  res.json({ ok: true });
});

export default router;

