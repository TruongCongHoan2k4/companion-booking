import * as adminStatsService from '../services/adminStats.service.js';
import * as adminActions from '../services/adminActions.service.js';

function handleError(res, err) {
  const status = err.status || 500;
  res.status(status).json({ message: err.message || 'Lỗi máy chủ.' });
}

export const dashboardStats = async (req, res) => {
  try {
    const data = await adminStatsService.getDashboardStats();
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message || 'Không tải được thống kê.' });
  }
};

export const pendingCompanions = async (req, res) => {
  try {
    const keyword = req.query.keyword;
    const data = await adminActions.listPendingCompanions(keyword);
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
};

export const approveCompanion = async (req, res) => {
  try {
    await adminActions.setCompanionStatus(req.params.id, 'APPROVED', {
      reason: req.body?.reason,
      adminUserId: req.auth.userId,
    });
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
};

export const rejectCompanion = async (req, res) => {
  try {
    await adminActions.setCompanionStatus(req.params.id, 'REJECTED', {
      reason: req.body?.reason,
      adminUserId: req.auth.userId,
    });
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
};

export const notificationsMe = async (req, res) => {
  try {
    const data = await adminActions.listAdminNotifications(req.auth.userId);
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
};

export const notificationRead = async (req, res) => {
  try {
    await adminActions.markNotificationRead(req.auth.userId, req.params.id);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
};

export const notificationsReadAll = async (req, res) => {
  try {
    await adminActions.markAllNotificationsRead(req.auth.userId);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
};

export const usersList = async (req, res) => {
  try {
    const data = await adminActions.listUsersAndCompanions(req.query.keyword);
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
};

export const userBan = async (req, res) => {
  try {
    await adminActions.banUser(req.params.userId, {
      reason: req.body?.reason,
      adminUserId: req.auth.userId,
    });
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
};

export const userWarn = async (req, res) => {
  try {
    await adminActions.warnUser(req.params.userId, {
      reason: req.body?.reason,
      adminUserId: req.auth.userId,
    });
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
};

export const userResetStatus = async (req, res) => {
  try {
    await adminActions.resetUserStatus(req.params.userId, {
      reason: req.body?.reason,
      adminUserId: req.auth.userId,
    });
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
};

export const moderationReviews = async (req, res) => {
  try {
    const data = await adminActions.listModerationReviews(req.query.keyword);
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
};

export const moderationReviewHide = async (req, res) => {
  try {
    await adminActions.hideReviewById(req.params.reviewId, {
      reason: req.body?.reason,
      adminUserId: req.auth.userId,
    });
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
};

export const transactions = async (req, res) => {
  try {
    const data = await adminActions.getAdminTransactions(req.query.keyword);
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
};

export const commissionRate = async (req, res) => {
  try {
    const rate = req.body?.commissionRate;
    await adminActions.setCommissionRate(rate);
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
};

export const withdrawalApprove = async (req, res) => {
  try {
    await adminActions.approveWithdrawal(req.params.id, {
      reason: req.body?.reason,
      adminUserId: req.auth.userId,
    });
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
};

export const withdrawalReject = async (req, res) => {
  try {
    await adminActions.rejectWithdrawal(req.params.id, {
      reason: req.body?.reason,
      adminUserId: req.auth.userId,
    });
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
};

export const disputesList = async (req, res) => {
  try {
    const data = await adminActions.listDisputes();
    res.json(data);
  } catch (err) {
    handleError(res, err);
  }
};

export const disputeAction = async (req, res) => {
  try {
    await adminActions.resolveReportAction(req.params.id, {
      action: req.actionType,
      reason: req.body?.reason,
      adminUserId: req.auth.userId,
    });
    res.json({ ok: true });
  } catch (err) {
    handleError(res, err);
  }
};
