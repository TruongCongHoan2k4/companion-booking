import Notification from '../models/notification.model.js';
import { publishNotification } from '../realtime/realtimeBroadcastService.js';

function formatVnd(amount) {
  try {
    const n = Number(amount);
    if (Number.isFinite(n)) return `${n.toLocaleString('vi-VN')} ₫`;
  } catch (_) {}
  return `${String(amount)} ₫`;
}

async function notify(userId, title, content) {
  if (!userId) return null;
  const n = await Notification.create({ user: userId, title, content, isRead: false });
  const full = await Notification.findById(n._id).populate('user');
  publishNotification(full);
  return full;
}

/**
 * Thông báo biến động ví (giữ cọc / hoàn / trừ / chi trả / nạp / rút).
 * @param {object} params
 * @param {string|import('mongoose').Types.ObjectId} params.userId
 * @param {'DEPOSIT'|'HOLD'|'REFUND'|'CHARGE'|'PAYOUT'} params.type
 * @param {bigint|number|string} params.amountVnd - số tiền tuyệt đối (VND)
 * @param {string} [params.description]
 * @param {string} [params.bookingId]
 * @param {string} [params.provider]
 */
export async function notifyWalletMutation({
  userId,
  type,
  amountVnd,
  description,
  bookingId,
  provider,
}) {
  try {
    const amt = typeof amountVnd === 'bigint' ? amountVnd.toString() : String(amountVnd ?? '0');
    const money = formatVnd(amt);
    const bid = bookingId ? String(bookingId) : '';
    const tail = [
      provider ? `Nguồn: ${String(provider)}` : '',
      bid ? `Booking #${bid}` : '',
      description ? String(description).trim() : '',
    ]
      .filter(Boolean)
      .join('\n');

    if (type === 'DEPOSIT') {
      return await notify(userId, 'Nạp tiền thành công', `Bạn đã nạp ${money} vào ví.${tail ? `\n${tail}` : ''}`);
    }
    if (type === 'HOLD') {
      return await notify(userId, 'Giữ cọc ví', `Ví của bạn đã bị giữ cọc ${money}.${tail ? `\n${tail}` : ''}`);
    }
    if (type === 'REFUND') {
      return await notify(userId, 'Hoàn tiền vào ví', `Bạn nhận được hoàn tiền ${money}.${tail ? `\n${tail}` : ''}`);
    }
    if (type === 'CHARGE') {
      return await notify(userId, 'Trừ tiền ví', `Ví của bạn bị trừ ${money}.${tail ? `\n${tail}` : ''}`);
    }
    if (type === 'PAYOUT') {
      return await notify(userId, 'Tiền đã được cộng vào ví', `Bạn nhận được ${money}.${tail ? `\n${tail}` : ''}`);
    }
    return null;
  } catch (e) {
    console.error('[notifyWalletMutation]', e?.message || e);
    return null;
  }
}

