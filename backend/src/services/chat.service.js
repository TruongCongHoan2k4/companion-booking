import ChatMessage from '../models/chatMessage.model.js';
import { assertBookingParticipant } from './bookingAccess.service.js';

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
