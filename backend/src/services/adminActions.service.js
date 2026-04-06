import Companion from '../models/companion.model.js';
import User from '../models/user.model.js';
import Notification from '../models/notification.model.js';
import Review from '../models/review.model.js';
import Report from '../models/report.model.js';
import Withdrawal from '../models/withdrawal.model.js';
import PlatformSettings from '../models/platformSettings.model.js';

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decToNumber(d) {
  if (d == null) return 0;
  const str = typeof d === 'object' && typeof d.toString === 'function' ? d.toString() : String(d);
  return Math.round(Number(str) || 0);
}

export async function listPendingCompanions(keyword) {
  const list = await Companion.find({ status: 'PENDING' })
    .populate('user', 'username')
    .sort({ updatedAt: -1 })
    .lean();

  const mapped = list.map((c) => ({
    id: String(c._id),
    user: { username: c.user?.username || '' },
    bio: c.bio || '',
    status: c.status,
  }));

  const q = keyword && String(keyword).trim();
  if (!q) return mapped;
  const lower = q.toLowerCase();
  return mapped.filter(
    (x) =>
      (x.user.username && x.user.username.toLowerCase().includes(lower)) ||
      (x.bio && x.bio.toLowerCase().includes(lower))
  );
}

export async function setCompanionStatus(companionId, status) {
  const c = await Companion.findByIdAndUpdate(companionId, { status }, { new: true });
  if (!c) {
    const err = new Error('Không tìm thấy companion.');
    err.status = 404;
    throw err;
  }
  return c;
}

export async function listAdminNotifications(adminUserId) {
  const list = await Notification.find({ user: adminUserId })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  return list.map((n) => ({
    id: String(n._id),
    title: n.title,
    content: n.content,
    isRead: Boolean(n.isRead),
    createdAt: n.createdAt,
  }));
}

export async function markNotificationRead(adminUserId, notifId) {
  await Notification.updateOne({ _id: notifId, user: adminUserId }, { $set: { isRead: true } });
}

export async function markAllNotificationsRead(adminUserId) {
  await Notification.updateMany({ user: adminUserId, isRead: false }, { $set: { isRead: true } });
}

export async function listUsersAndCompanions(keyword) {
  const q = keyword && String(keyword).trim();
  const userFilter = q
    ? {
        $or: [
          { username: new RegExp(escapeRegex(q), 'i') },
          { email: new RegExp(escapeRegex(q), 'i') },
        ],
      }
    : {};

  const [users, companions] = await Promise.all([
    User.find(userFilter).select('username email role moderationFlag').lean(),
    Companion.find({}).populate('user', 'username moderationFlag').sort({ updatedAt: -1 }).lean(),
  ]);

  const compFiltered =
    q
      ? companions.filter((c) => {
          const low = q.toLowerCase();
          const un = (c.user?.username || '').toLowerCase();
          const bio = (c.bio || '').toLowerCase();
          return un.includes(low) || bio.includes(low);
        })
      : companions;

  return {
    users: users.map((u) => ({
      id: String(u._id),
      username: u.username,
      email: u.email,
      role: u.role,
      flag:
        u.moderationFlag === 'BANNED'
          ? 'BANNED'
          : u.moderationFlag === 'WARNED'
            ? 'WARNED'
            : 'NONE',
    })),
    companions: compFiltered.map((c) => ({
      id: String(c._id),
      username: c.user?.username || '',
      status: c.status,
      flag:
        c.user?.moderationFlag === 'BANNED'
          ? 'BANNED'
          : c.user?.moderationFlag === 'WARNED'
            ? 'WARNED'
            : 'NONE',
      bio: c.bio || '',
    })),
  };
}

export async function banUser(userId) {
  const u = await User.findByIdAndUpdate(
    userId,
    { moderationFlag: 'BANNED', locked: true },
    { new: true }
  );
  if (!u) {
    const err = new Error('Không tìm thấy người dùng.');
    err.status = 404;
    throw err;
  }
}

export async function warnUser(userId) {
  const u = await User.findByIdAndUpdate(userId, { moderationFlag: 'WARNED' }, { new: true });
  if (!u) {
    const err = new Error('Không tìm thấy người dùng.');
    err.status = 404;
    throw err;
  }
}

export async function resetUserStatus(userId) {
  const u = await User.findByIdAndUpdate(
    userId,
    { moderationFlag: 'NONE', locked: false },
    { new: true }
  );
  if (!u) {
    const err = new Error('Không tìm thấy người dùng.');
    err.status = 404;
    throw err;
  }
}

export async function listModerationReviews(keyword) {
  let reviews = await Review.find({})
    .populate({ path: 'booking', select: '_id' })
    .sort({ createdAt: -1 })
    .limit(500)
    .lean();

  const q = keyword && String(keyword).trim();
  if (q) {
    const low = q.toLowerCase();
    reviews = reviews.filter((r) => (r.comment || '').toLowerCase().includes(low));
  }

  return reviews.map((r) => ({
    id: String(r._id),
    bookingId: r.booking?._id ? String(r.booking._id) : '',
    rating: r.rating,
    comment: r.comment || '',
    hidden: Boolean(r.hidden),
    createdAt: r.createdAt,
  }));
}

export async function hideReviewById(reviewId) {
  const r = await Review.findByIdAndUpdate(reviewId, { hidden: true }, { new: true });
  if (!r) {
    const err = new Error('Không tìm thấy review.');
    err.status = 404;
    throw err;
  }
}

async function getOrCreateSettings() {
  let s = await PlatformSettings.findOne();
  if (!s) {
    s = await PlatformSettings.create({});
  }
  return s;
}

export async function getAdminTransactions(keyword) {
  const settings = await getOrCreateSettings();
  const rate = settings.commissionRate ?? 0.15;

  let withdrawals = await Withdrawal.find({ status: 'PENDING' })
    .populate({
      path: 'companion',
      populate: { path: 'user', select: 'username' },
    })
    .sort({ createdAt: -1 })
    .lean();

  const q = keyword && String(keyword).trim();
  if (q) {
    const low = q.toLowerCase();
    withdrawals = withdrawals.filter((w) => {
      const name = (w.companion?.user?.username || '').toLowerCase();
      return name.includes(low) || (w.bankAccountNumber || '').includes(q);
    });
  }

  const pendingWithdrawals = withdrawals.map((w) => {
    const amount = decToNumber(w.amount);
    const commissionAmount = Math.round(amount * rate);
    const netAmount = Math.max(0, amount - commissionAmount);
    return {
      id: String(w._id),
      companionName: w.companion?.user?.username || '',
      bankName: w.bankName || '',
      bankAccountNumber: w.bankAccountNumber || '',
      amount,
      commissionAmount,
      netAmount,
      status: w.status,
      createdAt: w.createdAt,
    };
  });

  const allForChart = await Withdrawal.find({})
    .sort({ createdAt: -1 })
    .limit(300)
    .select('createdAt status')
    .lean();

  const withdrawalChartEvents = allForChart.map((w) => ({
    createdAt: w.createdAt,
    status: w.status,
  }));

  return {
    commissionRate: rate,
    pendingWithdrawals,
    withdrawalChartEvents,
  };
}

export async function setCommissionRate(rate) {
  const num = Number(rate);
  if (Number.isNaN(num) || num < 0 || num > 1) {
    const err = new Error('Tỷ lệ hoa hồng phải từ 0 đến 1.');
    err.status = 400;
    throw err;
  }
  await PlatformSettings.findOneAndUpdate({}, { commissionRate: num }, { upsert: true, new: true });
}

export async function approveWithdrawal(id) {
  const w = await Withdrawal.findByIdAndUpdate(id, { status: 'APPROVED' }, { new: true });
  if (!w) {
    const err = new Error('Không tìm thấy lệnh rút.');
    err.status = 404;
    throw err;
  }
}

export async function rejectWithdrawal(id) {
  const w = await Withdrawal.findByIdAndUpdate(id, { status: 'REJECTED' }, { new: true });
  if (!w) {
    const err = new Error('Không tìm thấy lệnh rút.');
    err.status = 404;
    throw err;
  }
}

export async function listDisputes() {
  const reports = await Report.find({})
    .populate('reporter', 'username')
    .populate('reportedUser', 'username')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  return reports.map((r) => ({
    id: String(r._id),
    reporter: r.reporter?.username || '',
    reportedUser: r.reportedUser?.username || '',
    reason: r.reason || '',
    status: r.status === 'RESOLVED' ? 'RESOLVED' : 'PENDING',
    createdAt: r.createdAt,
  }));
}

/** Xử lý tranh chấp tối giản: đánh dấu báo cáo đã xử lý (có thể mở rộng ký quỹ/hoàn tiền sau). */
export async function resolveReportAction(reportId) {
  const r = await Report.findByIdAndUpdate(reportId, { status: 'RESOLVED' }, { new: true });
  if (!r) {
    const err = new Error('Không tìm thấy báo cáo.');
    err.status = 404;
    throw err;
  }
}
