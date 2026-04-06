import mongoose from 'mongoose';
import Booking from '../models/booking.model.js';
import Companion from '../models/companion.model.js';
import User from '../models/user.model.js';
import WalletTransaction from '../models/walletTransaction.model.js';
import ServicePrice from '../models/servicePrice.model.js';
import PlatformSettings from '../models/platformSettings.model.js';
import * as bookingNotify from './bookingNotify.service.js';
import {
  bigIntToDecimal128,
  decimal128ToBigInt,
  computeHoldAmountVnd,
} from '../utils/money.util.js';

function isTxnUnsupported(err) {
  const msg = String(err?.message || '');
  return (
    msg.includes('Transaction numbers are only allowed on a replica set member or mongos') ||
    msg.includes('replica set') ||
    msg.includes('mongos')
  );
}

async function getOrCreateSettings() {
  let s = await PlatformSettings.findOne();
  if (!s) {
    s = await PlatformSettings.create({});
  }
  return s;
}

export function serializeBooking(doc) {
  if (!doc) return doc;
  const o = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  if (o._id != null && o.id == null) {
    o.id = String(o._id);
  }
  ['servicePricePerHour', 'holdAmount'].forEach((k) => {
    const v = o[k];
    if (v != null && typeof v === 'object' && typeof v.toString === 'function') {
      o[k] = v.toString();
    }
  });
  return o;
}

export async function createBooking(customerUserId, payload) {
  // Mỗi user chỉ được có 1 booking đang hoạt động tại một thời điểm.
  // "Đang hoạt động" = chưa kết thúc: PENDING/ACCEPTED/IN_PROGRESS.
  // (COMPLETED/REJECTED/CANCELLED được xem là đã kết thúc)
  const existing = await Booking.findOne({
    customer: customerUserId,
    status: { $in: ['PENDING', 'ACCEPTED', 'IN_PROGRESS'] },
  })
    .sort({ createdAt: -1 })
    .select('_id status')
    .lean();
  if (existing) {
    const err = new Error('Bạn đang có 1 đơn chưa kết thúc. Vui lòng hoàn tất/hủy đơn hiện tại trước khi đặt đơn mới.');
    err.status = 400;
    err.code = 'ACTIVE_BOOKING_EXISTS';
    throw err;
  }

  // Fallback mode: không dùng transaction nếu MongoDB không phải replica set.
  // Dev/local vẫn chạy được, đổi lại không còn atomicity (chấp nhận cho môi trường dev).
  async function createBookingNoTxn() {
    const companion = await Companion.findById(payload.companionId);
    if (!companion) {
      const err = new Error('Không tìm thấy companion.');
      err.status = 404;
      throw err;
    }
    if (companion.status !== 'APPROVED') {
      const err = new Error('Companion chưa được duyệt hoặc không khả dụng.');
      err.status = 400;
      throw err;
    }

    let priceDec = companion.pricePerHour;
    let serviceName = payload.serviceName || undefined;

    // Ưu tiên servicePriceId (UI mới)
    if (payload.servicePriceId) {
      const sp = await ServicePrice.findOne({ _id: payload.servicePriceId, companion: companion._id }).lean();
      if (!sp) {
        const err = new Error('Không tìm thấy dịch vụ đã chọn.');
        err.status = 400;
        throw err;
      }
      priceDec = sp.pricePerHour;
      serviceName = sp.serviceName || serviceName;
    } else if (payload.servicePricePerHour != null) {
      // Tương thích ngược
      priceDec = bigIntToDecimal128(BigInt(Math.floor(payload.servicePricePerHour)));
    }

    const holdBig = computeHoldAmountVnd(payload.duration, priceDec);
    if (holdBig <= 0n) {
      const err = new Error('Số tiền giữ cọc không hợp lệ.');
      err.status = 400;
      throw err;
    }

    const user = await User.findById(customerUserId);
    if (!user) {
      const err = new Error('Không tìm thấy khách hàng.');
      err.status = 404;
      throw err;
    }

    const bal = decimal128ToBigInt(user.balance);
    if (bal < holdBig) {
      const err = new Error('Số dư ví không đủ để giữ cọc.');
      err.status = 400;
      err.code = 'INSUFFICIENT_BALANCE';
      throw err;
    }

    const newBal = bal - holdBig;
    user.balance = bigIntToDecimal128(newBal);
    await user.save();

    const booking = await Booking.create({
      customer: customerUserId,
      companion: companion._id,
      bookingTime: new Date(payload.bookingTime),
      duration: payload.duration,
      location: payload.location || undefined,
      rentalVenue: payload.rentalVenue || undefined,
      serviceName,
      servicePricePerHour: priceDec,
      note: payload.note || undefined,
      holdAmount: bigIntToDecimal128(holdBig),
      status: 'PENDING',
    });

    await WalletTransaction.create({
      user: customerUserId,
      booking: booking._id,
      amount: bigIntToDecimal128(holdBig),
      type: 'HOLD',
      description: 'Giữ cọc đặt lịch (chờ companion xác nhận)',
    });

    return serializeBooking(booking);
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const companion = await Companion.findById(payload.companionId).session(session);
    if (!companion) {
      const err = new Error('Không tìm thấy companion.');
      err.status = 404;
      throw err;
    }
    if (companion.status !== 'APPROVED') {
      const err = new Error('Companion chưa được duyệt hoặc không khả dụng.');
      err.status = 400;
      throw err;
    }

    let priceDec = companion.pricePerHour;
    let serviceName = payload.serviceName || undefined;
    if (payload.servicePriceId) {
      const sp = await ServicePrice.findOne({ _id: payload.servicePriceId, companion: companion._id })
        .session(session)
        .lean();
      if (!sp) {
        const err = new Error('Không tìm thấy dịch vụ đã chọn.');
        err.status = 400;
        throw err;
      }
      priceDec = sp.pricePerHour;
      serviceName = sp.serviceName || serviceName;
    } else if (payload.servicePricePerHour != null) {
      priceDec = bigIntToDecimal128(BigInt(Math.floor(payload.servicePricePerHour)));
    }

    const holdBig = computeHoldAmountVnd(payload.duration, priceDec);
    if (holdBig <= 0n) {
      const err = new Error('Số tiền giữ cọc không hợp lệ.');
      err.status = 400;
      throw err;
    }

    const user = await User.findById(customerUserId).session(session);
    if (!user) {
      const err = new Error('Không tìm thấy khách hàng.');
      err.status = 404;
      throw err;
    }

    const bal = decimal128ToBigInt(user.balance);
    if (bal < holdBig) {
      const err = new Error('Số dư ví không đủ để giữ cọc.');
      err.status = 400;
      err.code = 'INSUFFICIENT_BALANCE';
      throw err;
    }

    const newBal = bal - holdBig;
    user.balance = bigIntToDecimal128(newBal);
    await user.save({ session });

    const [booking] = await Booking.create(
      [
        {
          customer: customerUserId,
          companion: companion._id,
          bookingTime: new Date(payload.bookingTime),
          duration: payload.duration,
          location: payload.location || undefined,
          rentalVenue: payload.rentalVenue || undefined,
          serviceName,
          servicePricePerHour: priceDec,
          note: payload.note || undefined,
          holdAmount: bigIntToDecimal128(holdBig),
          status: 'PENDING',
        },
      ],
      { session }
    );

    await WalletTransaction.create(
      [
        {
          user: customerUserId,
          booking: booking._id,
          amount: bigIntToDecimal128(holdBig),
          type: 'HOLD',
          description: 'Giữ cọc đặt lịch (chờ companion xác nhận)',
        },
      ],
      { session }
    );

    await session.commitTransaction();
    return serializeBooking(booking);
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (_) {}
    if (isTxnUnsupported(err)) {
      return await createBookingNoTxn();
    }
    throw err;
  } finally {
    session.endSession();
  }
}

export async function workflowBooking(companionDocId, bookingId, action) {
  async function workflowBookingNoTxn() {
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      const err = new Error('Không tìm thấy đơn đặt lịch.');
      err.status = 404;
      throw err;
    }
    if (booking.companion.toString() !== companionDocId.toString()) {
      const err = new Error('Bạn không có quyền xử lý đơn này.');
      err.status = 403;
      throw err;
    }
    if (booking.status !== 'PENDING') {
      const err = new Error('Đơn không còn ở trạng thái chờ xác nhận.');
      err.status = 400;
      throw err;
    }

    if (action === 'ACCEPT') {
      booking.status = 'ACCEPTED';
      booking.acceptedAt = new Date();
      await booking.save();
      return serializeBooking(booking);
    }

    if (action === 'REJECT') {
      booking.status = 'REJECTED';
      await booking.save();

      const refund = decimal128ToBigInt(booking.holdAmount);
      if (refund > 0n) {
        const customer = await User.findById(booking.customer);
        if (!customer) {
          const err = new Error('Không tìm thấy khách hàng để hoàn tiền.');
          err.status = 500;
          throw err;
        }
        const cBal = decimal128ToBigInt(customer.balance);
        customer.balance = bigIntToDecimal128(cBal + refund);
        await customer.save();

        await WalletTransaction.create({
          user: booking.customer,
          booking: booking._id,
          amount: bigIntToDecimal128(refund),
          type: 'REFUND',
          description: 'Hoàn cọc — companion từ chối đơn',
        });
      }
      return serializeBooking(booking);
    }

    const err = new Error('Hành động không hợp lệ.');
    err.status = 400;
    throw err;
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const booking = await Booking.findById(bookingId).session(session);
    if (!booking) {
      const err = new Error('Không tìm thấy đơn đặt lịch.');
      err.status = 404;
      throw err;
    }
    if (booking.companion.toString() !== companionDocId.toString()) {
      const err = new Error('Bạn không có quyền xử lý đơn này.');
      err.status = 403;
      throw err;
    }
    if (booking.status !== 'PENDING') {
      const err = new Error('Đơn không còn ở trạng thái chờ xác nhận.');
      err.status = 400;
      throw err;
    }

    if (action === 'ACCEPT') {
      booking.status = 'ACCEPTED';
      booking.acceptedAt = new Date();
      await booking.save({ session });
    } else if (action === 'REJECT') {
      booking.status = 'REJECTED';
      await booking.save({ session });

      const refund = decimal128ToBigInt(booking.holdAmount);
      if (refund > 0n) {
        const customer = await User.findById(booking.customer).session(session);
        if (!customer) {
          const err = new Error('Không tìm thấy khách hàng để hoàn tiền.');
          err.status = 500;
          throw err;
        }
        const cBal = decimal128ToBigInt(customer.balance);
        customer.balance = bigIntToDecimal128(cBal + refund);
        await customer.save({ session });

        await WalletTransaction.create(
          [
            {
              user: booking.customer,
              booking: booking._id,
              amount: bigIntToDecimal128(refund),
              type: 'REFUND',
              description: 'Hoàn cọc — companion từ chối đơn',
            },
          ],
          { session }
        );
      }
    }

    await session.commitTransaction();
    return serializeBooking(booking);
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (_) {}
    if (isTxnUnsupported(err)) {
      return await workflowBookingNoTxn();
    }
    throw err;
  } finally {
    session.endSession();
  }
}

async function assertBookingParticipantMutable(bookingId, userId, role) {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error('Không tìm thấy đơn đặt lịch.');
    err.status = 404;
    throw err;
  }
  if (booking.customer.toString() === userId) {
    return booking;
  }
  if (role === 'COMPANION') {
    const companion = await Companion.findOne({ user: userId });
    if (companion && booking.companion.toString() === companion._id.toString()) {
      return booking;
    }
  }
  const err = new Error('Bạn không có quyền thực hiện thao tác này với đơn này.');
  err.status = 403;
  throw err;
}

export async function checkInBooking(userId, role, bookingId) {
  const booking = await assertBookingParticipantMutable(bookingId, userId, role);
  if (booking.status !== 'ACCEPTED') {
    const err = new Error('Chỉ check-in khi đơn đã được companion chấp nhận.');
    err.status = 400;
    throw err;
  }
  if (!['CUSTOMER', 'COMPANION'].includes(role)) {
    const err = new Error('Vai trò không hợp lệ.');
    err.status = 400;
    throw err;
  }

  const now = new Date();
  // Nếu chưa có yêu cầu, tạo yêu cầu từ phía gọi.
  if (!booking.checkInRequestedBy || !booking.checkInRequestedAt) {
    booking.checkInRequestedBy = role;
    booking.checkInRequestedAt = now;
    await booking.save();
    void bookingNotify.notifyCheckInRequested(booking, role);
    return { step: 'REQUESTED', booking: serializeBooking(booking) };
  }

  // Nếu đã có yêu cầu từ cùng phía → không làm gì thêm.
  if (booking.checkInRequestedBy === role) {
    return { step: 'REQUESTED', booking: serializeBooking(booking) };
  }

  // Yêu cầu đã có từ phía còn lại → xác nhận và bắt đầu phiên.
  booking.checkInConfirmedAt = now;
  booking.status = 'IN_PROGRESS';
  booking.startedAt = now;
  await booking.save();
  void bookingNotify.notifyCheckInConfirmed(booking);
  return { step: 'CONFIRMED', booking: serializeBooking(booking) };
}

export async function checkOutBooking(userId, role, bookingId) {
  const booking = await assertBookingParticipantMutable(bookingId, userId, role);
  if (booking.status !== 'IN_PROGRESS') {
    const err = new Error('Chỉ check-out khi phiên đang diễn ra.');
    err.status = 400;
    throw err;
  }
  if (!['CUSTOMER', 'COMPANION'].includes(role)) {
    const err = new Error('Vai trò không hợp lệ.');
    err.status = 400;
    throw err;
  }

  const now = new Date();
  if (!booking.checkOutRequestedBy || !booking.checkOutRequestedAt) {
    booking.checkOutRequestedBy = role;
    booking.checkOutRequestedAt = now;
    await booking.save();
    void bookingNotify.notifyCheckOutRequested(booking, role);
    return { step: 'REQUESTED', booking: serializeBooking(booking) };
  }

  if (booking.checkOutRequestedBy === role) {
    return { step: 'REQUESTED', booking: serializeBooking(booking) };
  }

  booking.checkOutConfirmedAt = now;
  booking.status = 'COMPLETED';
  booking.completedAt = now;
  await booking.save();

  // Quyết toán: cộng tiền vào ví companion để rút (net = hold - commission)
  try {
    const settings = await getOrCreateSettings();
    const rate = settings.commissionRate ?? 0.15;
    const gross = decimal128ToBigInt(booking.holdAmount);
    const commission = BigInt(Math.max(0, Math.round(Number(gross) * rate)));
    const net = gross > commission ? gross - commission : 0n;

    if (net > 0n) {
      const companion = await Companion.findById(booking.companion).select('user').lean();
      const companionUserId = companion?.user;
      if (companionUserId) {
        const cu = await User.findById(companionUserId);
        if (cu) {
          const bal = decimal128ToBigInt(cu.balance);
          cu.balance = bigIntToDecimal128(bal + net);
          await cu.save();
        }
        await WalletTransaction.create({
          user: companionUserId,
          booking: booking._id,
          amount: bigIntToDecimal128(net),
          type: 'PAYOUT',
          provider: 'BOOKING',
          description: `Thanh toán booking #${String(booking._id)} (sau hoa hồng)`,
        });
      }
    }
  } catch (e) {
    // Dev-friendly: nếu payout lỗi, vẫn giữ booking COMPLETED; admin có thể đối soát thủ công.
    console.warn('[settlement] payout failed', e?.message || e);
  }

  void bookingNotify.notifyCheckOutConfirmed(booking);
  return { step: 'CONFIRMED', booking: serializeBooking(booking) };
}

export async function cancelBooking(userId, role, bookingId) {
  const booking = await assertBookingParticipantMutable(bookingId, userId, role);
  if (role !== 'CUSTOMER') {
    const err = new Error('Chỉ khách hàng mới được hủy đơn.');
    err.status = 403;
    throw err;
  }
  if (!['PENDING', 'ACCEPTED'].includes(booking.status)) {
    const err = new Error('Chỉ hủy được khi đơn đang PENDING hoặc ACCEPTED.');
    err.status = 400;
    throw err;
  }
  booking.status = 'CANCELLED';
  await booking.save();

  // Chính sách hủy/hoàn:
  // - Trước 24h: hoàn 100% cọc
  // - Từ 6h–24h: hoàn 50% cọc
  // - Dưới 6h: không hoàn
  const hold = decimal128ToBigInt(booking.holdAmount);
  let refund = 0n;
  try {
    const bt = booking.bookingTime ? new Date(booking.bookingTime).getTime() : NaN;
    const diffMs = bt - Date.now();
    const h24 = 24 * 60 * 60 * 1000;
    const h6 = 6 * 60 * 60 * 1000;
    if (Number.isFinite(diffMs) && diffMs >= h24) refund = hold;
    else if (Number.isFinite(diffMs) && diffMs >= h6) refund = hold / 2n;
    else refund = 0n;
  } catch {
    refund = 0n;
  }

  if (refund > 0n) {
    const customer = await User.findById(booking.customer);
    if (customer) {
      const cBal = decimal128ToBigInt(customer.balance);
      customer.balance = bigIntToDecimal128(cBal + refund);
      await customer.save();
    }
    await WalletTransaction.create({
      user: booking.customer,
      booking: booking._id,
      amount: bigIntToDecimal128(refund),
      type: 'REFUND',
      description:
        refund === hold
          ? 'Hoàn cọc 100% — hủy trước 24h'
          : 'Hoàn cọc 50% — hủy trong 6–24h trước giờ hẹn',
    });
  }
  const out = serializeBooking(booking);
  out.refundAmount = refund.toString();
  out.refundPolicy = refund === hold ? 'FULL_24H' : refund > 0n ? 'HALF_6_24H' : 'NO_REFUND_LT_6H';
  return out;
}

export async function requestBookingExtension(customerUserId, bookingId, extraMinutes) {
  const booking = await assertBookingParticipantMutable(bookingId, customerUserId, 'CUSTOMER');
  if (!['ACCEPTED', 'IN_PROGRESS'].includes(booking.status)) {
    const err = new Error('Chỉ xin gia hạn khi đơn đã ACCEPTED hoặc IN_PROGRESS.');
    err.status = 400;
    throw err;
  }
  const extra = Number(extraMinutes);
  if (!Number.isFinite(extra) || extra !== 30) {
    const err = new Error('extraMinutes không hợp lệ (chỉ hỗ trợ 30 phút).');
    err.status = 400;
    throw err;
  }
  const used = Number(booking.extensionMinutesApproved || 0);
  const pending = booking.pendingExtensionMinutes != null ? Number(booking.pendingExtensionMinutes) : 0;
  const max = 120;
  const remaining = max - used - pending;
  if (remaining < extra) {
    const err = new Error('Bạn đã vượt giới hạn gia hạn cho booking này.');
    err.status = 400;
    throw err;
  }
  booking.pendingExtensionMinutes = extra;
  booking.extensionRequestedAt = new Date();
  await booking.save();
  void bookingNotify.notifyExtensionRequested(booking);
  return serializeBooking(booking);
}

export async function cancelBookingExtensionRequest(customerUserId, bookingId) {
  const booking = await assertBookingParticipantMutable(bookingId, customerUserId, 'CUSTOMER');
  if (booking.pendingExtensionMinutes == null) {
    const err = new Error('Không có yêu cầu gia hạn nào để hủy.');
    err.status = 400;
    throw err;
  }
  booking.pendingExtensionMinutes = undefined;
  await booking.save();
  return serializeBooking(booking);
}

export async function companionDecideExtension(companionUserId, bookingId, decision) {
  const companion = await Companion.findOne({ user: companionUserId });
  if (!companion) {
    const err = new Error('Không tìm thấy companion.');
    err.status = 404;
    throw err;
  }
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error('Không tìm thấy đơn đặt lịch.');
    err.status = 404;
    throw err;
  }
  if (String(booking.companion) !== String(companion._id)) {
    const err = new Error('Bạn không có quyền xử lý gia hạn đơn này.');
    err.status = 403;
    throw err;
  }
  if (booking.pendingExtensionMinutes == null) {
    const err = new Error('Không có yêu cầu gia hạn đang chờ.');
    err.status = 400;
    throw err;
  }
  const pending = Number(booking.pendingExtensionMinutes || 0);
  booking.pendingExtensionMinutes = undefined;
  if (decision === 'ACCEPT') {
    // Tính thêm tiền gia hạn và giữ cọc bổ sung từ ví khách.
    // extraHold = ceil(extraMinutes * pricePerHour / 60)
    const extraHold = computeHoldAmountVnd(pending, booking.servicePricePerHour);
    if (extraHold > 0n) {
      const customer = await User.findById(booking.customer);
      if (!customer) {
        const err = new Error('Không tìm thấy khách hàng để giữ cọc gia hạn.');
        err.status = 500;
        throw err;
      }
      const bal = decimal128ToBigInt(customer.balance);
      if (bal < extraHold) {
        const err = new Error('Số dư ví khách hàng không đủ để giữ cọc gia hạn.');
        err.status = 400;
        err.code = 'INSUFFICIENT_BALANCE_EXTENSION';
        throw err;
      }
      customer.balance = bigIntToDecimal128(bal - extraHold);
      await customer.save();

      const currentHold = decimal128ToBigInt(booking.holdAmount);
      booking.holdAmount = bigIntToDecimal128(currentHold + extraHold);

      await WalletTransaction.create({
        user: booking.customer,
        booking: booking._id,
        amount: bigIntToDecimal128(extraHold),
        type: 'HOLD',
        provider: 'EXTENSION',
        description: `Giữ cọc gia hạn +${pending} phút cho booking #${String(booking._id)}`,
      });
    }

    const used = Number(booking.extensionMinutesApproved || 0);
    booking.extensionMinutesApproved = used + pending;
    booking.duration = Number(booking.duration || 0) + pending;
  }
  await booking.save();
  void bookingNotify.notifyExtensionDecided(booking, decision);
  return serializeBooking(booking);
}

export async function listBookingsForUser(userId, role, query) {
  const status = query.status;
  const filter = {};
  if (status && ['PENDING', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)) {
    filter.status = status;
  }

  if (role === 'CUSTOMER') {
    filter.customer = userId;
  } else if (role === 'COMPANION') {
    const companion = await Companion.findOne({ user: userId });
    if (!companion) {
      return [];
    }
    filter.companion = companion._id;
  } else {
    return [];
  }

  const rows = await Booking.find(filter)
    .populate({
      path: 'companion',
      populate: { path: 'user', select: 'username fullName' },
    })
    .populate({ path: 'customer', select: 'username fullName' })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return rows.map((b) => serializeBooking(b));
}
