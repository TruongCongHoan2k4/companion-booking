import Notification from '../models/notification.model.js';
import Companion from '../models/companion.model.js';
import {
  publishNotification,
  publishBookingStatusToRoom,
} from '../realtime/realtimeBroadcastService.js';

async function notify(userId, title, content) {
  if (!userId) return null;
  const n = await Notification.create({ user: userId, title, content });
  const full = await Notification.findById(n._id).populate('user');
  publishNotification(full);
  return full;
}

async function resolveCompanionUserId(companionId) {
  const c = await Companion.findById(companionId).populate('user');
  return c?.user?._id || null;
}

/**
 * Đơn mới (PENDING) — thông báo tài khoản companion.
 */
export async function notifyBookingCreated(booking) {
  try {
    const bid = booking._id?.toString?.() ?? String(booking._id);
    const companionUserId = await resolveCompanionUserId(booking.companion);
    if (!companionUserId) return;
    await notify(companionUserId, 'Đơn đặt lịch mới', `Bạn có đơn chờ xác nhận (mã ${bid}).`);

    publishBookingStatusToRoom(bid, {
      bookingId: bid,
      status: booking.status || 'PENDING',
      event: 'created',
    });
  } catch (e) {
    console.error('[notifyBookingCreated]', e.message);
  }
}

/**
 * Companion chấp nhận / từ chối — thông báo khách + room booking.
 */
export async function notifyBookingWorkflow(booking, action) {
  try {
    const bid = booking._id?.toString?.() ?? String(booking._id);
    const customerId = booking.customer?.toString?.() ?? booking.customer;

    const title =
      action === 'ACCEPT' ? 'Đơn đã được chấp nhận' : 'Đơn bị từ chối';
    const content =
      action === 'ACCEPT'
        ? `Companion đã chấp nhận đơn #${bid}.`
        : `Companion đã từ chối đơn #${bid}. Cọc đã hoàn về ví (nếu có).`;

    await notify(customerId, title, content);

    publishBookingStatusToRoom(bid, {
      bookingId: bid,
      status: booking.status,
      action,
    });
  } catch (e) {
    console.error('[notifyBookingWorkflow]', e.message);
  }
}

export async function notifyCheckInRequested(booking, requestedByRole) {
  try {
    const bid = booking._id?.toString?.() ?? String(booking._id);
    const customerId = booking.customer?.toString?.() ?? booking.customer;
    const companionUserId = await resolveCompanionUserId(booking.companion);
    if (!companionUserId) return;

    const targetUserId = requestedByRole === 'CUSTOMER' ? companionUserId : customerId;
    const title = 'Yêu cầu xác nhận check-in';
    const content =
      requestedByRole === 'CUSTOMER'
        ? `Khách hàng yêu cầu check-in cho đơn #${bid}. Vui lòng xác nhận.`
        : `Companion yêu cầu check-in cho đơn #${bid}. Vui lòng xác nhận.`;
    await notify(targetUserId, title, content);

    publishBookingStatusToRoom(bid, {
      bookingId: bid,
      status: booking.status,
      event: 'checkin_requested',
      requestedBy: requestedByRole,
    });
  } catch (e) {
    console.error('[notifyCheckInRequested]', e.message);
  }
}

export async function notifyCheckInConfirmed(booking) {
  try {
    const bid = booking._id?.toString?.() ?? String(booking._id);
    const customerId = booking.customer?.toString?.() ?? booking.customer;
    const companionUserId = await resolveCompanionUserId(booking.companion);
    await Promise.all([
      notify(customerId, 'Check-in đã được xác nhận', `Booking #${bid} đã check-in, phiên bắt đầu.`),
      companionUserId
        ? notify(companionUserId, 'Check-in đã được xác nhận', `Booking #${bid} đã check-in, phiên bắt đầu.`)
        : Promise.resolve(),
    ]);
    publishBookingStatusToRoom(bid, {
      bookingId: bid,
      status: booking.status,
      event: 'checkin_confirmed',
    });
  } catch (e) {
    console.error('[notifyCheckInConfirmed]', e.message);
  }
}

export async function notifyCheckOutRequested(booking, requestedByRole) {
  try {
    const bid = booking._id?.toString?.() ?? String(booking._id);
    const customerId = booking.customer?.toString?.() ?? booking.customer;
    const companionUserId = await resolveCompanionUserId(booking.companion);
    if (!companionUserId) return;

    const targetUserId = requestedByRole === 'CUSTOMER' ? companionUserId : customerId;
    const title = 'Yêu cầu xác nhận check-out';
    const content =
      requestedByRole === 'CUSTOMER'
        ? `Khách hàng yêu cầu check-out cho đơn #${bid}. Vui lòng xác nhận.`
        : `Companion yêu cầu check-out cho đơn #${bid}. Vui lòng xác nhận.`;
    await notify(targetUserId, title, content);

    publishBookingStatusToRoom(bid, {
      bookingId: bid,
      status: booking.status,
      event: 'checkout_requested',
      requestedBy: requestedByRole,
    });
  } catch (e) {
    console.error('[notifyCheckOutRequested]', e.message);
  }
}

export async function notifyCheckOutConfirmed(booking) {
  try {
    const bid = booking._id?.toString?.() ?? String(booking._id);
    const customerId = booking.customer?.toString?.() ?? booking.customer;
    const companionUserId = await resolveCompanionUserId(booking.companion);
    await Promise.all([
      notify(customerId, 'Check-out đã được xác nhận', `Booking #${bid} đã check-out, đơn đã hoàn tất.`),
      companionUserId
        ? notify(companionUserId, 'Check-out đã được xác nhận', `Booking #${bid} đã check-out, đơn đã hoàn tất.`)
        : Promise.resolve(),
    ]);
    publishBookingStatusToRoom(bid, {
      bookingId: bid,
      status: booking.status,
      event: 'checkout_confirmed',
    });
  } catch (e) {
    console.error('[notifyCheckOutConfirmed]', e.message);
  }
}

/**
 * Khách xin gia hạn — thông báo companion + room booking.
 */
export async function notifyExtensionRequested(booking) {
  try {
    const bid = booking._id?.toString?.() ?? String(booking._id);
    const companionUserId = await resolveCompanionUserId(booking.companion);
    if (!companionUserId) return;
    const extra = Number(booking.pendingExtensionMinutes || 0);
    const title = 'Yêu cầu gia hạn';
    const content = `Khách hàng xin gia hạn ${extra || 30} phút cho đơn #${bid}. Vui lòng phản hồi.`;
    await notify(companionUserId, title, content);

    publishBookingStatusToRoom(bid, {
      bookingId: bid,
      status: booking.status,
      event: 'extension_requested',
      requestedBy: 'CUSTOMER',
      extraMinutes: extra || 30,
    });
  } catch (e) {
    console.error('[notifyExtensionRequested]', e.message);
  }
}

/**
 * Companion phản hồi gia hạn — thông báo khách + room booking.
 * decision: 'ACCEPT' | 'REJECT'
 */
export async function notifyExtensionDecided(booking, decision) {
  try {
    const bid = booking._id?.toString?.() ?? String(booking._id);
    const customerId = booking.customer?.toString?.() ?? booking.customer;
    const extra = Number(booking.extensionMinutesApproved || 0);
    const title = decision === 'ACCEPT' ? 'Gia hạn đã được chấp nhận' : 'Gia hạn bị từ chối';
    const content =
      decision === 'ACCEPT'
        ? `Companion đã chấp nhận gia hạn cho đơn #${bid}.`
        : `Companion đã từ chối yêu cầu gia hạn cho đơn #${bid}.`;
    await notify(customerId, title, content);

    publishBookingStatusToRoom(bid, {
      bookingId: bid,
      status: booking.status,
      event: decision === 'ACCEPT' ? 'extension_accepted' : 'extension_rejected',
      decidedBy: 'COMPANION',
      extensionMinutesApproved: Number(booking.extensionMinutesApproved || 0),
      duration: Number(booking.duration || 0),
    });
  } catch (e) {
    console.error('[notifyExtensionDecided]', e.message);
  }
}
