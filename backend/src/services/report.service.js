import mongoose from 'mongoose';
import Report from '../models/report.model.js';
import User from '../models/user.model.js';

export async function createReport(reporterUserId, body) {
  const reportedUserId = body.reportedUserId;
  if (!mongoose.Types.ObjectId.isValid(reportedUserId)) {
    const err = new Error('reportedUserId không hợp lệ.');
    err.status = 400;
    throw err;
  }
  const ok = await User.exists({ _id: reportedUserId });
  if (!ok) {
    const err = new Error('Không tìm thấy người bị tố cáo.');
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
  if (body.bookingId && mongoose.Types.ObjectId.isValid(body.bookingId)) {
    payload.relatedBookingId = body.bookingId;
  }

  const doc = await Report.create(payload);
  return {
    id: String(doc._id),
    reporter: { id: String(reporterUserId) },
    reportedUser: { id: String(reportedUserId) },
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
    reason: r.reason || '',
    category: r.category || '',
    emergency: Boolean(r.emergency),
    status: r.status,
    reporterLatitude: r.reporterLatitude ?? null,
    reporterLongitude: r.reporterLongitude ?? null,
    createdAt: r.createdAt,
  }));
}

