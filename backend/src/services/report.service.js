import mongoose from 'mongoose';
import Report from '../models/report.model.js';
import User from '../models/user.model.js';
import Booking from '../models/booking.model.js';
import Companion from '../models/companion.model.js';
import { assertBookingParticipant } from './bookingAccess.service.js';

export async function createReport(reporterUserId, body) {
  const bookingId = body.bookingId;
  if (!mongoose.Types.ObjectId.isValid(bookingId)) {
    const err = new Error('bookingId không hợp lệ.');
    err.status = 400;
    throw err;
  }
  const gate = await assertBookingParticipant(bookingId, reporterUserId);
  if (!gate.ok) {
    const err = new Error(gate.message);
    err.status = gate.status;
    throw err;
  }

  const booking = gate.booking || (await Booking.findById(bookingId).lean());
  if (!booking) {
    const err = new Error('Không tìm thấy đơn.');
    err.status = 404;
    throw err;
  }

  // Nghiệp vụ: chỉ cho phép báo cáo khi đơn đang diễn ra hoặc đã kết thúc.
  // - IN_PROGRESS: dùng tiền cọc (holdAmount) để xử lý tranh chấp.
  // - COMPLETED: tiền đã về ví companion, xử lý hoàn sẽ trừ ngược từ ví đó.
  const status = String(booking.status || '').toUpperCase();
  if (!['IN_PROGRESS', 'COMPLETED'].includes(status)) {
    const err = new Error('Chỉ có thể gửi tố cáo khi đơn đang diễn ra (IN_PROGRESS) hoặc đã kết thúc (COMPLETED).');
    err.status = 409;
    throw err;
  }

  // Suy ra user bị tố cáo theo đơn:
  // - Nếu reporter là customer => tố cáo companion.user
  // - Nếu reporter là companion.user => tố cáo customer
  let reportedUserId;
  if (String(booking.customer) === String(reporterUserId)) {
    const comp = await Companion.findById(booking.companion).lean();
    if (!comp?.user) {
      const err = new Error('Không tìm thấy companion của đơn.');
      err.status = 404;
      throw err;
    }
    reportedUserId = String(comp.user);
  } else {
    reportedUserId = String(booking.customer);
  }

  const ok = await User.exists({ _id: reportedUserId });
  if (!ok) {
    const err = new Error('Không tìm thấy người bị tố cáo trong đơn này.');
    err.status = 404;
    throw err;
  }

  const payload = {
    reporter: reporterUserId,
    reportedUser: reportedUserId,
    reason: body.reason,
    category: body.category || undefined,
    emergency: body.emergency === true,
    reporterLatitude: body.reporterLatitude ?? undefined,
    reporterLongitude: body.reporterLongitude ?? undefined,
  };
  payload.relatedBookingId = bookingId;

  const doc = await Report.create(payload);
  return {
    id: String(doc._id),
    reporter: { id: String(reporterUserId) },
    reportedUser: { id: String(reportedUserId) },
    booking: { id: String(bookingId) },
    reason: doc.reason,
    category: doc.category || '',
    emergency: Boolean(doc.emergency),
    status: doc.status,
    reporterLatitude: doc.reporterLatitude ?? null,
    reporterLongitude: doc.reporterLongitude ?? null,
    createdAt: doc.createdAt,
  };
}

export async function listMyReports(reporterUserId) {
  const rows = await Report.find({ reporter: reporterUserId })
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();

  return rows.map((r) => ({
    id: String(r._id),
    reportedUser: { id: String(r.reportedUser) },
    booking: r.relatedBookingId ? { id: String(r.relatedBookingId) } : null,
    reason: r.reason || '',
    category: r.category || '',
    emergency: Boolean(r.emergency),
    status: r.status,
    reporterLatitude: r.reporterLatitude ?? null,
    reporterLongitude: r.reporterLongitude ?? null,
    createdAt: r.createdAt,
  }));
}

