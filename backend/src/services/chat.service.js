import ChatMessage from '../models/chatMessage.model.js';
import { assertBookingParticipant } from './bookingAccess.service.js';
import Booking from '../models/booking.model.js';
import Companion from '../models/companion.model.js';
import User from '../models/user.model.js';

const CHAT_ALLOWED_STATUSES = new Set(['ACCEPTED', 'IN_PROGRESS']);

function assertChatAllowedToSend(booking) {
  const status = String(booking?.status || '').toUpperCase();
  if (CHAT_ALLOWED_STATUSES.has(status)) return;
  const err = new Error(
    `Chat chỉ mở khi đơn ở trạng thái ACCEPTED/IN_PROGRESS. Trạng thái hiện tại: ${booking?.status || '-'}`
  );
  err.status = 409;
  throw err;
}

function serializeMessage(row) {
  const o = row;
  const sender = o.sender;
  const sid = sender?._id ?? sender;
  const username = typeof sender === 'object' && sender?.username ? sender.username : '';
  return {
    id: String(o._id),
    bookingId: String(o.booking),
    senderId: String(sid),
    senderUsername: username,
    content: o.content,
    createdAt: o.createdAt ? new Date(o.createdAt).toISOString() : null,
  };
}

export async function listMessagesForUser(bookingId, userId) {
  const gate = await assertBookingParticipant(bookingId, userId);
  if (!gate.ok) {
    const err = new Error(gate.message);
    err.status = gate.status;
    throw err;
  }
  const rows = await ChatMessage.find({ booking: bookingId })
    .sort({ createdAt: 1 })
    .limit(300)
    .populate('sender', 'username')
    .lean();
  return rows.map((r) => serializeMessage(r));
}

export async function createMessageForUser(bookingId, userId, content) {
  const gate = await assertBookingParticipant(bookingId, userId);
  if (!gate.ok) {
    const err = new Error(gate.message);
    err.status = gate.status;
    throw err;
  }
  assertChatAllowedToSend(gate.booking);
  const text = String(content || '').trim();
  if (!text) {
    const err = new Error('Nội dung tin nhắn không được để trống.');
    err.status = 400;
    throw err;
  }
  const row = await ChatMessage.create({
    booking: bookingId,
    sender: userId,
    content: text.slice(0, 2000),
  });
  const populated = await ChatMessage.findById(row._id).populate('sender', 'username').lean();
  return serializeMessage(populated);
}

export async function getCallInfoForUser(bookingId, userId) {
  const gate = await assertBookingParticipant(bookingId, userId);
  if (!gate.ok) {
    const err = new Error(gate.message);
    err.status = gate.status;
    throw err;
  }

  const booking = await Booking.findById(bookingId).lean();
  if (!booking) {
    const err = new Error('Không tìm thấy đơn.');
    err.status = 404;
    throw err;
  }

  let contactPhone = '';
  if (booking.customer?.toString() === userId) {
    const comp = await Companion.findById(booking.companion).lean();
    if (comp?.user) {
      const u = await User.findById(comp.user).lean();
      contactPhone = u?.phone || '';
    }
  } else {
    const u = await User.findById(booking.customer).lean();
    contactPhone = u?.phone || '';
  }

  // UI chỉ cần “roomId/token + số liên hệ” để hiển thị (demo). Realtime call (WebRTC/VoIP) có thể làm sau.
  return {
    roomId: `booking-${String(bookingId)}`,
    token: `demo-${String(userId)}-${String(bookingId)}`,
    contactPhone,
    customerPhone: booking.customer?.toString() === userId ? '' : contactPhone,
    companionPhone: booking.customer?.toString() === userId ? contactPhone : '',
  };
}
