import mongoose from 'mongoose';
import Review from '../models/review.model.js';
import Booking from '../models/booking.model.js';
import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';
import { publishNotification } from '../realtime/realtimeBroadcastService.js';

export async function createReview(customerUserId, body) {
  const bookingId = body.bookingId;
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    const err = new Error('bookingId không hợp lệ.');
    err.status = 400;
    throw err;
  }
  const booking = await Booking.findById(bookingId).populate({
    path: 'companion',
    populate: { path: 'user', select: 'username fullName' },
  });
  if (!booking) {
    const err = new Error('Không tìm thấy booking.');
    err.status = 404;
    throw err;
  }
  if (String(booking.customer) !== String(customerUserId)) {
    const err = new Error('Bạn không có quyền đánh giá booking này.');
    err.status = 403;
    throw err;
  }
  if (booking.status !== 'COMPLETED') {
    const err = new Error('Chỉ được đánh giá khi booking đã COMPLETED.');
    err.status = 400;
    throw err;
  }

  const existed = await Review.exists({ booking: booking._id });
  const doc = await Review.findOneAndUpdate(
    { booking: booking._id },
    { $set: { rating: body.rating, comment: body.comment || '' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  // Lưu snapshot rating vào booking (phục vụ UI/đối soát sau này).
  // Không thay đổi nghiệp vụ hiện tại, chỉ lưu 1 field gọn nhẹ.
  await Booking.updateOne(
    { _id: booking._id },
    { $set: { companionRatingForUser: Number(body.rating) } }
  );

  // Gửi thông báo cho companion khi có đánh giá mới (không spam nếu user sửa lại đánh giá).
  if (!existed && booking.companion?.user?._id) {
    const companionUserId = booking.companion.user._id;
    const reviewerName = booking.customer?.toString?.() === String(customerUserId) ? 'Khách hàng' : 'Khách';
    const title = 'Bạn có đánh giá mới';
    const content = `${reviewerName} đã đánh giá booking #${String(booking._id)}: ${Number(body.rating)}★\n${String(
      body.comment || ''
    ).trim() || '—'}`;
    const n = await Notification.create({
      user: companionUserId,
      title,
      content,
      isRead: false,
    });
    const full = await Notification.findById(n._id).populate('user');
    publishNotification(full);
  }

  // Nếu đánh giá thấp (< 3.5★) thì cảnh báo tài khoản companion.
  // Vì rating hiện là integer 1..5 nên điều kiện này tương đương 1..3 sao.
  let companionWarned = false;
  if (!existed && booking.companion?.user?._id && Number(body.rating) < 3.5) {
    const companionUserId = booking.companion.user._id;
    // Lưu ý: user cũ có thể thiếu field moderationFlag (default không auto backfill).
    // Chỉ không hạ cờ nếu đang BANNED.
    const u = await User.findById(companionUserId).select('_id moderationFlag').lean();
    if (u && u.moderationFlag !== 'BANNED') {
      const up = await User.updateOne({ _id: companionUserId }, { $set: { moderationFlag: 'WARNED' } });
      companionWarned = (up.modifiedCount || 0) > 0;
    }

    const title = 'Cảnh báo đánh giá thấp';
    const content = `Bạn vừa nhận đánh giá dưới 3,5★ cho booking #${String(
      booking._id
    )}. Tài khoản của bạn đã bị gắn cờ cảnh báo.`;
    const n = await Notification.create({
      user: companionUserId,
      title,
      content,
      isRead: false,
    });
    const full = await Notification.findById(n._id).populate('user');
    publishNotification(full);
  }

  return {
    id: String(doc._id),
    booking: {
      id: String(booking._id),
      companion: booking.companion
        ? {
            id: String(booking.companion._id),
            user: booking.companion.user
              ? {
                  id: String(booking.companion.user._id),
                  username: booking.companion.user.username,
                  fullName: booking.companion.user.fullName,
                }
              : undefined,
          }
        : undefined,
    },
    rating: doc.rating,
    comment: doc.comment || '',
    hidden: Boolean(doc.hidden),
    warning: Number(body.rating) < 3.5
      ? {
          code: 'COMPANION_LOW_RATING_WARN',
          message: 'Đánh giá dưới 3,5★: tài khoản companion sẽ bị cảnh báo.',
          companionWarned,
        }
      : undefined,
    createdAt: doc.createdAt,
  };
}

export async function listMyReviews(customerUserId) {
  const rows = await Review.find({})
    .populate({
      path: 'booking',
      populate: {
        path: 'companion',
        populate: { path: 'user', select: 'username fullName' },
      },
    })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  // lọc theo booking.customer (không có trong populate ở trên)
  const bookingIds = rows.map((r) => r.booking?._id).filter(Boolean);
  const bookings = await Booking.find({ _id: { $in: bookingIds }, customer: customerUserId }).select('_id').lean();
  const allowed = new Set(bookings.map((b) => String(b._id)));

  return rows
    .filter((r) => r.booking?._id && allowed.has(String(r.booking._id)))
    .map((r) => ({
      id: String(r._id),
      booking: r.booking
        ? {
            id: String(r.booking._id),
            companion: r.booking.companion
              ? {
                  id: String(r.booking.companion._id),
                  user: r.booking.companion.user
                    ? {
                        id: String(r.booking.companion.user._id),
                        username: r.booking.companion.user.username,
                        fullName: r.booking.companion.user.fullName,
                      }
                    : undefined,
                }
              : undefined,
          }
        : undefined,
      rating: r.rating,
      comment: r.comment || '',
      hidden: Boolean(r.hidden),
      createdAt: r.createdAt,
    }));
}

