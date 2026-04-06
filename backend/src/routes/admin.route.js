import express from 'express';
import { verifyToken } from '../middleware/verifyToken.middleware.js';
import { requireAdmin } from '../middleware/requireAdmin.middleware.js';
import { validateMongoIdParam } from '../middleware/mongoIdParam.middleware.js';
import * as adminController from '../controllers/admin.controller.js';

const router = express.Router();

router.use(verifyToken);
router.use(requireAdmin);

router.get('/dashboard-stats', adminController.dashboardStats);
router.get('/pending-companions', adminController.pendingCompanions);
router.post(
  '/approve-companion/:id',
  validateMongoIdParam('id'),
  adminController.approveCompanion
);
router.post('/reject-companion/:id', validateMongoIdParam('id'), adminController.rejectCompanion);

router.get('/notifications/me', adminController.notificationsMe);
router.patch('/notifications/read-all', adminController.notificationsReadAll);
router.patch(
  '/notifications/:id/read',
  validateMongoIdParam('id'),
  adminController.notificationRead
);

router.get('/users', adminController.usersList);
router.post('/users/:userId/ban', validateMongoIdParam('userId'), adminController.userBan);
router.post('/users/:userId/warn', validateMongoIdParam('userId'), adminController.userWarn);
router.put(
  '/users/:userId/reset-status',
  validateMongoIdParam('userId'),
  adminController.userResetStatus
);

router.get('/moderation/reviews', adminController.moderationReviews);
router.post(
  '/moderation/reviews/:reviewId/hide',
  validateMongoIdParam('reviewId'),
  adminController.moderationReviewHide
);

router.get('/transactions', adminController.transactions);
router.put('/transactions/commission-rate', adminController.commissionRate);
router.post(
  '/transactions/withdrawals/:id/approve',
  validateMongoIdParam('id'),
  adminController.withdrawalApprove
);
router.post(
  '/transactions/withdrawals/:id/reject',
  validateMongoIdParam('id'),
  adminController.withdrawalReject
);

router.get('/disputes', adminController.disputesList);
router.post(
  '/disputes/:id/freeze-escrow',
  validateMongoIdParam('id'),
  adminController.disputeAction
);
router.post('/disputes/:id/refund', validateMongoIdParam('id'), adminController.disputeAction);
router.post('/disputes/:id/payout', validateMongoIdParam('id'), adminController.disputeAction);
router.post('/disputes/:id/close', validateMongoIdParam('id'), adminController.disputeAction);

export default router;
