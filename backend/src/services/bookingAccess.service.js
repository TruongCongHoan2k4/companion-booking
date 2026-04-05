import mongoose from 'mongoose';
import Booking from '../models/booking.model.js';
import Companion from '../models/companion.model.js';

export async function assertBookingParticipant(bookingId, userId) {
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    return { ok: false, status: 400, message: 'ID booking không hợp lệ.' };
  }
  const booking = await Booking.findById(bookingId).lean();
  if (!booking) {
    return { ok: false, status: 404, message: 'Không tìm thấy đơn.' };
  }
  if (booking.customer.toString() === userId) {
    return { ok: true, booking };
  }
  const companion = await Companion.findById(booking.companion).lean();
  if (companion && companion.user.toString() === userId) {
    return { ok: true, booking };
  }
  return { ok: false, status: 403, message: 'Bạn không thuộc đơn booking này.' };
}
