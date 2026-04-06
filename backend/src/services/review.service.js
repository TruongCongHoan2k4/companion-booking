import mongoose from 'mongoose';
import Review from '../models/review.model.js';
import Booking from '../models/booking.model.js';

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

  const doc = await Review.findOneAndUpdate(
    { booking: booking._id },
    { $set: { rating: body.rating, comment: body.comment || '' } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

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

