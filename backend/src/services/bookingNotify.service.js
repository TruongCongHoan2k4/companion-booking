import Notification from '../models/notification.model.js';
import Companion from '../models/companion.model.js';
import {
  publishNotification,
  publishBookingStatusToRoom,
} from '../realtime/realtimeBroadcastService.js';

/**
 * Đơn mới (PENDING) — thông báo tài khoản companion.
 */
export async function notifyBookingCreated(booking) {
  try {
    const bid = booking._id?.toString?.() ?? String(booking._id);
    const c = await Companion.findById(booking.companion).populate('user');
    if (!c?.user) return;

    const n = await Notification.create({
      user: c.user._id,
      title: 'Đơn đặt lịch mới',
      content: `Bạn có đơn chờ xác nhận (mã ${bid}).`,
    });
    const full = await Notification.findById(n._id).populate('user');
    publishNotification(full);

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

    const n = await Notification.create({
      user: customerId,
      title,
      content,
    });
    const full = await Notification.findById(n._id).populate('user');
    publishNotification(full);

    publishBookingStatusToRoom(bid, {
      bookingId: bid,
      status: booking.status,
      action,
    });
  } catch (e) {
    console.error('[notifyBookingWorkflow]', e.message);
  }
}
