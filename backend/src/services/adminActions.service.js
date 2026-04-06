import mongoose from 'mongoose';
import Companion from '../models/companion.model.js';
import User from '../models/user.model.js';
import Notification from '../models/notification.model.js';
import Review from '../models/review.model.js';
import Report from '../models/report.model.js';
import Withdrawal from '../models/withdrawal.model.js';
import PlatformSettings from '../models/platformSettings.model.js';
import WalletTransaction from '../models/walletTransaction.model.js';
import Booking from '../models/booking.model.js';
import { bigIntToDecimal128, decimal128ToBigInt } from '../utils/money.util.js';
import { publishNotification } from '../realtime/realtimeBroadcastService.js';
import { notifyWalletMutation } from './walletNotify.service.js';

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decToNumber(d) {
  if (d == null) return 0;
  const str = typeof d === 'object' && typeof d.toString === 'function' ? d.toString() : String(d);
  return Math.round(Number(str) || 0);
}

function normalizeReason(reason) {
  return String(reason || '').trim();
}

function ensureReason(reason, minLen, message) {
  const value = normalizeReason(reason);
  if (value.length < minLen) {
    const err = new Error(message);
    err.status = 400;
    throw err;
  }
  return value;
}

function isTxnUnsupported(err) {
  const msg = String(err?.message || '');
  return (
    msg.includes('Transaction numbers are only allowed on a replica set member or mongos') ||
    msg.includes('replica set') ||
    msg.includes('mongos')
  );
}

async function notifyUser(userId, title, content) {
  if (!userId) return;
  const n = await Notification.create({
    user: userId,
    title,
    content,
    isRead: false,
  });
  const full = await Notification.findById(n._id).populate('user');
  publishNotification(full);
}

export async function listPendingCompanions(keyword) {
  const list = await Companion.find({ status: 'PENDING' })
    .populate('user', 'username email fullName')
    .sort({ updatedAt: -1 })
    .lean();

  const mapped = list.map((c) => ({
    id: String(c._id),
    user: {
      id: c.user?._id ? String(c.user._id) : '',
      username: c.user?.username || '',
      email: c.user?.email || '',
      fullName: c.user?.fullName || '',
    },
    status: c.status,
    bio: c.bio || '',
    hobbies: c.hobbies || '',
    appearance: c.appearance || '',
    availability: c.availability || '',
    serviceType: c.serviceType || '',
    area: c.area || '',
    rentalVenues: c.rentalVenues || '',
    gender: c.gender || '',
    gameRank: c.gameRank || '',
    avatarUrl: c.avatarUrl || '',
    coverImageUrl: c.coverImageUrl || '',
    introVideoUrl: c.introVideoUrl || '',
    introMediaUrls: c.introMediaUrls || '',
    skills: c.skills || '',
    identityNumber: c.identityNumber || '',
    identityImageUrl: c.identityImageUrl || '',
    portraitImageUrl: c.portraitImageUrl || '',
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

export async function setCompanionStatus(companionId, status, options = {}) {
  const reason =
    status === 'REJECTED'
      ? ensureReason(options.reason, 1, 'Vui lòng nhập lý do từ chối hồ sơ.')
      : normalizeReason(options.reason);
  const c = await Companion.findByIdAndUpdate(companionId, { status }, { new: true }).populate(
    'user',
    '_id'
  );
  if (!c) {
    const err = new Error('Không tìm thấy companion.');
    err.status = 404;
    throw err;
  }

  // Khi admin duyệt hồ sơ → mới chính thức nâng role user lên COMPANION.
  // Khi bị từ chối → giữ nguyên CUSTOMER để user có thể nộp lại.
  if (status === 'APPROVED' && c.user?._id) {
    await User.updateOne({ _id: c.user._id }, { $set: { role: 'COMPANION' } });
  }

  const note = reason ? `\nLý do: ${reason}` : '';
  await notifyUser(
    c.user?._id,
    status === 'APPROVED' ? 'Hồ sơ Companion đã được duyệt' : 'Hồ sơ Companion bị từ chối',
    status === 'APPROVED'
      ? `Admin đã duyệt hồ sơ Companion của bạn.${note}`
      : `Admin đã từ chối hồ sơ Companion của bạn.${note}`
  );
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

export async function banUser(userId, options = {}) {
  const reason = ensureReason(options.reason, 1, 'Vui lòng nhập lý do khóa tài khoản.');
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
  await notifyUser(
    u._id,
    'Tài khoản bị khóa',
    `Tài khoản của bạn đã bị khóa bởi admin.\nLý do: ${reason}`
  );
}

export async function warnUser(userId, options = {}) {
  const reason = ensureReason(options.reason, 1, 'Vui lòng nhập lý do cảnh cáo.');
  const u = await User.findByIdAndUpdate(userId, { moderationFlag: 'WARNED' }, { new: true });
  if (!u) {
    const err = new Error('Không tìm thấy người dùng.');
    err.status = 404;
    throw err;
  }
  await notifyUser(
    u._id,
    'Bạn nhận được cảnh cáo từ admin',
    `Tài khoản của bạn đã bị cảnh cáo.\nLý do: ${reason}`
  );
}

export async function resetUserStatus(userId, options = {}) {
  const note = normalizeReason(options.reason);
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
  await notifyUser(
    u._id,
    'Trạng thái tài khoản đã được khôi phục',
    `Tài khoản của bạn đã trở về trạng thái bình thường.${note ? `\nGhi chú: ${note}` : ''}`
  );
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

export async function hideReviewById(reviewId, options = {}) {
  const reason = ensureReason(options.reason, 1, 'Vui lòng nhập lý do ẩn review.');
  const r = await Review.findByIdAndUpdate(reviewId, { hidden: true }, { new: true });
  if (!r) {
    const err = new Error('Không tìm thấy review.');
    err.status = 404;
    throw err;
  }
  void options.adminUserId;
  void reason;
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

export async function approveWithdrawal(id, options = {}) {
  const note = normalizeReason(options.reason);
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const w = await Withdrawal.findById(id).session(session).populate({
      path: 'companion',
      select: 'user',
    });
    if (!w) {
      const err = new Error('Không tìm thấy lệnh rút.');
      err.status = 404;
      throw err;
    }
    if (w.status !== 'PENDING') {
      const err = new Error('Lệnh rút tiền không còn ở trạng thái chờ duyệt.');
      err.status = 400;
      throw err;
    }
    w.status = 'APPROVED';
    await w.save({ session });

    await session.commitTransaction();

    await notifyUser(
      w.companion?.user,
      'Lệnh rút tiền đã được duyệt',
      `Yêu cầu rút tiền của bạn đã được duyệt.${note ? `\nGhi chú: ${note}` : ''}`
    );
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (_) {}
    if (isTxnUnsupported(err)) {
      const w = await Withdrawal.findById(id).populate({ path: 'companion', select: 'user' });
      if (!w) {
        const e = new Error('Không tìm thấy lệnh rút.');
        e.status = 404;
        throw e;
      }
      if (w.status !== 'PENDING') {
        const e = new Error('Lệnh rút tiền không còn ở trạng thái chờ duyệt.');
        e.status = 400;
        throw e;
      }
      w.status = 'APPROVED';
      await w.save();
      await notifyUser(
        w.companion?.user,
        'Lệnh rút tiền đã được duyệt',
        `Yêu cầu rút tiền của bạn đã được duyệt.${note ? `\nGhi chú: ${note}` : ''}`
      );
      return;
    }
    throw err;
  } finally {
    session.endSession();
  }
}

export async function rejectWithdrawal(id, options = {}) {
  const reason = ensureReason(options.reason, 1, 'Vui lòng nhập lý do từ chối lệnh rút.');
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const w = await Withdrawal.findById(id).session(session).populate({
      path: 'companion',
      select: 'user',
    });
    if (!w) {
      const err = new Error('Không tìm thấy lệnh rút.');
      err.status = 404;
      throw err;
    }
    if (w.status !== 'PENDING') {
      const err = new Error('Lệnh rút tiền không còn ở trạng thái chờ duyệt.');
      err.status = 400;
      throw err;
    }

    const companionUserId = w.companion?.user;
    if (!companionUserId) {
      const err = new Error('Không tìm thấy user của companion để hoàn tiền.');
      err.status = 500;
      throw err;
    }

    const refund = decimal128ToBigInt(w.amount);
    if (refund > 0n) {
      const user = await User.findById(companionUserId).session(session);
      if (!user) {
        const err = new Error('Không tìm thấy người dùng để hoàn tiền.');
        err.status = 500;
        throw err;
      }
      const bal = decimal128ToBigInt(user.balance);
      user.balance = bigIntToDecimal128(bal + refund);
      await user.save({ session });

      await WalletTransaction.create(
        [
          {
            user: companionUserId,
            amount: bigIntToDecimal128(refund),
            type: 'REFUND',
            provider: 'WITHDRAWAL',
            description: `Hoàn tiền lệnh rút bị từ chối #${String(w._id)}`,
          },
        ],
        { session }
      );
      void notifyWalletMutation({
        userId: companionUserId,
        type: 'REFUND',
        amountVnd: refund,
        provider: 'WITHDRAWAL',
        description: `Hoàn tiền lệnh rút bị từ chối #${String(w._id)}`,
      });
    }

    w.status = 'REJECTED';
    await w.save({ session });

    await session.commitTransaction();

    await notifyUser(
      w.companion?.user,
      'Lệnh rút tiền bị từ chối',
      `Yêu cầu rút tiền của bạn đã bị từ chối.\nLý do: ${reason}`
    );
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (_) {}
    if (isTxnUnsupported(err)) {
      const w = await Withdrawal.findById(id).populate({ path: 'companion', select: 'user' });
      if (!w) {
        const e = new Error('Không tìm thấy lệnh rút.');
        e.status = 404;
        throw e;
      }
      if (w.status !== 'PENDING') {
        const e = new Error('Lệnh rút tiền không còn ở trạng thái chờ duyệt.');
        e.status = 400;
        throw e;
      }
      const companionUserId = w.companion?.user;
      if (!companionUserId) {
        const e = new Error('Không tìm thấy user của companion để hoàn tiền.');
        e.status = 500;
        throw e;
      }
      const refund = decimal128ToBigInt(w.amount);
      if (refund > 0n) {
        const user = await User.findById(companionUserId);
        if (!user) {
          const e = new Error('Không tìm thấy người dùng để hoàn tiền.');
          e.status = 500;
          throw e;
        }
        const bal = decimal128ToBigInt(user.balance);
        user.balance = bigIntToDecimal128(bal + refund);
        await user.save();
        await WalletTransaction.create({
          user: companionUserId,
          amount: bigIntToDecimal128(refund),
          type: 'REFUND',
          provider: 'WITHDRAWAL',
          description: `Hoàn tiền lệnh rút bị từ chối #${String(w._id)}`,
        });
        void notifyWalletMutation({
          userId: companionUserId,
          type: 'REFUND',
          amountVnd: refund,
          provider: 'WITHDRAWAL',
          description: `Hoàn tiền lệnh rút bị từ chối #${String(w._id)}`,
        });
      }
      w.status = 'REJECTED';
      await w.save();
      await notifyUser(
        w.companion?.user,
        'Lệnh rút tiền bị từ chối',
        `Yêu cầu rút tiền của bạn đã bị từ chối.\nLý do: ${reason}`
      );
      return;
    }
    throw err;
  } finally {
    session.endSession();
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
    emergency: Boolean(r.emergency),
    category: r.category || '',
    resolutionAction: r.resolutionAction || '',
    resolutionNote: r.resolutionNote || '',
    lastActionAt: r.lastActionAt || r.createdAt,
    createdAt: r.createdAt,
  }));
}

/** Xử lý tranh chấp tối giản: đánh dấu báo cáo đã xử lý (có thể mở rộng ký quỹ/hoàn tiền sau). */
export async function resolveReportAction(reportId, options = {}) {
  const action = options.action;
  if (!['REFUND', 'PAYOUT'].includes(action)) {
    const err = new Error('Hành động tranh chấp không hợp lệ.');
    err.status = 400;
    throw err;
  }
  const actionLabel = action === 'REFUND' ? 'Hoàn tiền' : 'Chi trả';
  const note = ensureReason(options.reason, 1, 'Vui lòng nhập biên bản xử lý tranh chấp.');

  const r0 = await Report.findById(reportId);
  if (!r0) {
    const err = new Error('Không tìm thấy báo cáo.');
    err.status = 404;
    throw err;
  }
  if (r0.status === 'RESOLVED') {
    const err = new Error('Báo cáo này đã được xử lý trước đó.');
    err.status = 409;
    throw err;
  }
  const bookingId = r0.relatedBookingId;
  if (!bookingId) {
    const err = new Error('Báo cáo không gắn với đơn booking nên không thể quyết toán.');
    err.status = 400;
    throw err;
  }

  const booking = await Booking.findById(bookingId).select('customer companion holdAmount status').lean();
  if (!booking) {
    const err = new Error('Không tìm thấy đơn booking liên quan.');
    err.status = 404;
    throw err;
  }
  const bookingStatus = String(booking.status || '').toUpperCase();
  if (!['IN_PROGRESS', 'COMPLETED'].includes(bookingStatus)) {
    const err = new Error('Chỉ xử lý tranh chấp cho đơn đang diễn ra (IN_PROGRESS) hoặc đã kết thúc (COMPLETED).');
    err.status = 409;
    throw err;
  }

  const existingSettlement = await WalletTransaction.exists({
    booking: bookingId,
    type: { $in: ['REFUND', 'PAYOUT'] },
  });
  if (existingSettlement) {
    const err = new Error('Đơn này đã có giao dịch hoàn/chi trước đó. Không thể thực hiện lại.');
    err.status = 409;
    throw err;
  }

  const gross = decimal128ToBigInt(booking.holdAmount);
  if (gross <= 0n) {
    const err = new Error('Đơn không có số tiền ký quỹ để xử lý.');
    err.status = 400;
    throw err;
  }

  const settings = await getOrCreateSettings();
  const rate = settings.commissionRate ?? 0.15;
  const commission = BigInt(Math.max(0, Math.round(Number(gross) * rate)));
  const net = gross > commission ? gross - commission : 0n;

  if (action === 'REFUND') {
    if (bookingStatus === 'IN_PROGRESS') {
      // Đơn đang diễn ra: hoàn trực tiếp từ tiền cọc (escrow/holdAmount).
      const customer = await User.findById(booking.customer);
      if (!customer) {
        const err = new Error('Không tìm thấy khách hàng để hoàn tiền.');
        err.status = 500;
        throw err;
      }
      const bal = decimal128ToBigInt(customer.balance);
      customer.balance = bigIntToDecimal128(bal + gross);
      await customer.save();
      await WalletTransaction.create({
        user: booking.customer,
        booking: bookingId,
        amount: bigIntToDecimal128(gross),
        type: 'REFUND',
        provider: 'DISPUTE',
        description: `Hoàn tiền từ cọc theo tranh chấp #${String(r0._id)}`,
      });
      void notifyWalletMutation({
        userId: booking.customer,
        type: 'REFUND',
        amountVnd: gross,
        bookingId,
        provider: 'DISPUTE',
        description: `Hoàn tiền từ cọc theo tranh chấp #${String(r0._id)}`,
      });
    } else {
      // Đơn đã kết thúc: tiền đã vào ví companion (net). Hoàn ngược bằng cách trừ ví companion và cộng cho customer.
      if (net <= 0n) {
        const err = new Error('Số tiền sau hoa hồng không hợp lệ để hoàn ngược.');
        err.status = 400;
        throw err;
      }
      const comp = await Companion.findById(booking.companion).select('user').lean();
      const companionUserId = comp?.user;
      if (!companionUserId) {
        const err = new Error('Không tìm thấy user của companion để hoàn ngược.');
        err.status = 500;
        throw err;
      }
      const cu = await User.findById(companionUserId);
      const customer = await User.findById(booking.customer);
      if (!cu || !customer) {
        const err = new Error('Không tìm thấy ví để hoàn ngược.');
        err.status = 500;
        throw err;
      }
      const cBal = decimal128ToBigInt(cu.balance);
      if (cBal < net) {
        const err = new Error('Số dư companion không đủ để hoàn ngược theo tranh chấp.');
        err.status = 409;
        throw err;
      }
      cu.balance = bigIntToDecimal128(cBal - net);
      await cu.save();
      await WalletTransaction.create({
        user: companionUserId,
        booking: bookingId,
        amount: bigIntToDecimal128(net),
        type: 'CHARGE',
        provider: 'DISPUTE',
        description: `Trừ tiền hoàn ngược theo tranh chấp #${String(r0._id)}`,
      });
      void notifyWalletMutation({
        userId: companionUserId,
        type: 'CHARGE',
        amountVnd: net,
        bookingId,
        provider: 'DISPUTE',
        description: `Trừ tiền hoàn ngược theo tranh chấp #${String(r0._id)}`,
      });

      const uBal = decimal128ToBigInt(customer.balance);
      customer.balance = bigIntToDecimal128(uBal + net);
      await customer.save();
      await WalletTransaction.create({
        user: booking.customer,
        booking: bookingId,
        amount: bigIntToDecimal128(net),
        type: 'REFUND',
        provider: 'DISPUTE',
        description: `Hoàn ngược từ ví companion theo tranh chấp #${String(r0._id)}`,
      });
      void notifyWalletMutation({
        userId: booking.customer,
        type: 'REFUND',
        amountVnd: net,
        bookingId,
        provider: 'DISPUTE',
        description: `Hoàn ngược từ ví companion theo tranh chấp #${String(r0._id)}`,
      });
    }
  } else {
    // PAYOUT
    if (bookingStatus === 'IN_PROGRESS') {
      // Đơn đang diễn ra: chi trả sớm từ tiền cọc (net) vào ví companion.
      if (net <= 0n) {
        const err = new Error('Số tiền sau hoa hồng không hợp lệ để chi trả.');
        err.status = 400;
        throw err;
      }
      const comp = await Companion.findById(booking.companion).select('user').lean();
      const companionUserId = comp?.user;
      if (!companionUserId) {
        const err = new Error('Không tìm thấy user của companion để chi trả.');
        err.status = 500;
        throw err;
      }
      const cu = await User.findById(companionUserId);
      if (!cu) {
        const err = new Error('Không tìm thấy ví của companion để chi trả.');
        err.status = 500;
        throw err;
      }
      const bal = decimal128ToBigInt(cu.balance);
      cu.balance = bigIntToDecimal128(bal + net);
      await cu.save();
      await WalletTransaction.create({
        user: companionUserId,
        booking: bookingId,
        amount: bigIntToDecimal128(net),
        type: 'PAYOUT',
        provider: 'DISPUTE',
        description: `Chi trả từ cọc theo tranh chấp #${String(r0._id)} (sau hoa hồng)`,
      });
      void notifyWalletMutation({
        userId: companionUserId,
        type: 'PAYOUT',
        amountVnd: net,
        bookingId,
        provider: 'DISPUTE',
        description: `Chi trả từ cọc theo tranh chấp #${String(r0._id)} (sau hoa hồng)`,
      });
    } else {
      // Đơn đã kết thúc: payout đã được quyết toán lúc check-out, nên không chi lại.
      // Chỉ cập nhật biên bản/RESOLVED.
    }
  }

  const update = {
    status: 'RESOLVED',
    resolutionAction: action,
    resolutionNote: note,
    lastActionAt: new Date(),
    resolvedAt: new Date(),
    resolvedBy: options.adminUserId,
  };
  const r = await Report.findByIdAndUpdate(reportId, update, { new: true });

  const summary = `Báo cáo của bạn đã được admin xử lý với hành động: ${actionLabel}.`;
  const detail = `${summary}\nBiên bản: ${note}`;
  await Promise.all([
    notifyUser(r.reporter, 'Cập nhật xử lý tranh chấp', detail),
    notifyUser(r.reportedUser, 'Cập nhật xử lý tranh chấp', detail),
  ]);
}
