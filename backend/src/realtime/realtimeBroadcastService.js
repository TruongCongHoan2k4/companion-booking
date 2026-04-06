import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import ChatMessage from '../models/chatMessage.model.js';
import { assertBookingParticipant } from '../services/bookingAccess.service.js';

let io;

const COOKIE_NAME = 'accessToken';
const CHAT_ALLOWED_STATUSES = new Set(['ACCEPTED', 'IN_PROGRESS']);

function getTokenFromHandshake(handshake) {
  const auth = handshake.auth?.token;
  if (auth && typeof auth === 'string' && auth.trim()) return auth.trim();
  const q = handshake.query?.token;
  if (q && typeof q === 'string' && q.trim()) return q.trim();
  const cookieHeader = handshake.headers?.cookie;
  if (!cookieHeader) return null;
  const parts = cookieHeader.split(';').map((c) => c.trim());
  for (const p of parts) {
    if (p.startsWith(`${COOKIE_NAME}=`)) {
      return decodeURIComponent(p.slice(COOKIE_NAME.length + 1));
    }
  }
  return null;
}

function roomBooking(bookingId) {
  return `booking_${bookingId}`;
}

function roomUser(userId) {
  return `user_${userId}`;
}

/**
 * @param {import('http').Server} server
 */
export function initRealtime(server) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  io = new Server(server, {
    path: '/socket.io',
    cors: {
      origin: frontendUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  io.use((socket, next) => {
    // Dev-friendly: cho phép kết nối socket ngay cả khi chưa đăng nhập.
    // Nếu có token hợp lệ thì attach userId/role; nếu không thì vẫn next() để tránh proxy ECONNRESET spam.
    try {
      const token = getTokenFromHandshake(socket.handshake);
      const secret = process.env.ACCESS_TOKEN_SECRET;
      if (token && secret) {
        const decoded = jwt.verify(token, secret);
        const sub = decoded.sub || decoded.userId || decoded.id;
        if (sub) {
          socket.data.userId = String(sub);
          socket.data.role = decoded.role;
        }
      }
    } catch {
      // ignore
    }
    next();
  });

  io.on('connection', (socket) => {
    const uid = socket.data.userId;
    if (uid) {
      socket.join(roomUser(uid));
    }

    socket.on('join_room', async (payload, ack) => {
      try {
        if (!uid) {
          ack?.({ ok: false, message: 'UNAUTHORIZED' });
          return;
        }
        const bookingId = payload?.bookingId;
        if (!bookingId || typeof bookingId !== 'string') {
          ack?.({ ok: false, message: 'Thiếu bookingId.' });
          return;
        }
        const gate = await assertBookingParticipant(bookingId, uid);
        if (!gate.ok) {
          ack?.({ ok: false, message: gate.message });
          return;
        }
        socket.join(roomBooking(bookingId));
        ack?.({ ok: true, room: roomBooking(bookingId) });
      } catch (e) {
        ack?.({ ok: false, message: e.message || 'join_room lỗi.' });
      }
    });

    socket.on('send_message', async (payload, ack) => {
      try {
        if (!uid) {
          ack?.({ ok: false, message: 'UNAUTHORIZED' });
          return;
        }
        const bookingId = payload?.bookingId;
        const content = typeof payload?.content === 'string' ? payload.content.trim() : '';
        if (!bookingId || !content) {
          ack?.({ ok: false, message: 'Thiếu bookingId hoặc nội dung.' });
          return;
        }
        if (content.length > 2000) {
          ack?.({ ok: false, message: 'Tin nhắn quá dài (tối đa 2000 ký tự).' });
          return;
        }
        const gate = await assertBookingParticipant(bookingId, uid);
        if (!gate.ok) {
          ack?.({ ok: false, message: gate.message });
          return;
        }
        const status = String(gate.booking?.status || '').toUpperCase();
        if (!CHAT_ALLOWED_STATUSES.has(status)) {
          ack?.({
            ok: false,
            message: `Chat chỉ mở khi đơn ở trạng thái ACCEPTED/IN_PROGRESS. Trạng thái hiện tại: ${gate.booking?.status || '-'}`,
          });
          return;
        }

        const msg = await ChatMessage.create({
          booking: bookingId,
          sender: uid,
          content,
        });

        const populated = await ChatMessage.findById(msg._id)
          .populate('sender', 'username')
          .populate({ path: 'booking', select: '_id' });

        publishChatMessage(populated);
        ack?.({
          ok: true,
          message: buildChatPayload(populated),
        });
      } catch (e) {
        ack?.({ ok: false, message: e.message || 'Gửi tin thất bại.' });
      }
    });

    socket.on('disconnect', () => {
      /* noop */
    });
  });

  return io;
}

function buildChatPayload(msg) {
  const bookingId = msg.booking?._id ?? msg.booking;
  const senderId = msg.sender?._id ?? msg.sender;
  return {
    id: String(msg._id),
    bookingId: String(bookingId),
    senderId: String(senderId),
    senderUsername: msg.sender?.username ?? '',
    content: msg.content,
    createdAt: msg.createdAt ? msg.createdAt.toISOString() : null,
  };
}

/**
 * @param {import('mongoose').Document} msg — populate sender, booking
 */
export function publishChatMessage(msg) {
  if (!io || !msg) return;
  const payload = buildChatPayload(msg);
  const bookingId = payload.bookingId;
  io.to(roomBooking(bookingId)).emit('chat_message', payload);
}

/**
 * @param {import('mongoose').Document} n — populate user
 */
export function publishNotification(n) {
  if (!io || !n) return;
  const userId = n.user?._id ?? n.user;
  const payload = {
    id: String(n._id),
    title: n.title,
    content: n.content,
    isRead: Boolean(n.isRead),
    createdAt: n.createdAt ? n.createdAt.toISOString() : null,
  };
  io.to(roomUser(String(userId))).emit('notification', payload);
}

export function publishBookingStatusToRoom(bookingId, payload) {
  if (!io) return;
  io.to(roomBooking(bookingId)).emit('booking_status', payload);
}
