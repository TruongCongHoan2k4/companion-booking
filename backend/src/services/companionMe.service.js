import mongoose from 'mongoose';
import Booking from '../models/booking.model.js';
import Companion from '../models/companion.model.js';
import User from '../models/user.model.js';
import Consultation from '../models/consultation.model.js';
import Withdrawal from '../models/withdrawal.model.js';
import { serializeBooking, workflowBooking, companionDecideExtension } from './booking.service.js';
import { bigIntToDecimal128, decimal128ToBigInt } from '../utils/money.util.js';

function decToNumber(d) {
  if (d == null) return 0;
  const str = typeof d === 'object' && d.toString === 'function' ? d.toString() : String(d);
  return Math.round(Number(str) || 0);
}

export async function listCompanionBookings(userId) {
  const companion = await Companion.findOne({ user: userId }).lean();
  if (!companion) return [];
  const rows = await Booking.find({ companion: companion._id })
    .populate('customer', 'username fullName')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return rows.map((b) => {
    const o = serializeBooking(b);
    o.id = String(b._id);
    delete o._id;
    if (b.customer && typeof b.customer === 'object') {
      o.customer = {
        id: String(b.customer._id),
        username: b.customer.username,
        fullName: b.customer.fullName,
      };
    }
    return o;
  });
}

export async function companionBookingWorkflow(userId) {
  const list = await listCompanionBookings(userId);
  const now = Date.now();
  const pending = [];
  const upcoming = [];
  const running = [];
  const done = [];
  for (const b of list) {
    if (b.status === 'PENDING') {
      pending.push(b);
    } else if (b.status === 'ACCEPTED') {
      if (new Date(b.bookingTime).getTime() > now) upcoming.push(b);
      else running.push(b);
    } else if (b.status === 'IN_PROGRESS') {
      running.push(b);
    } else if (['COMPLETED', 'REJECTED', 'CANCELLED'].includes(b.status)) {
      done.push(b);
    }
  }
  return { pending, upcoming, running, done };
}

export async function companionIncomeStats(userId) {
  const companion = await Companion.findOne({ user: userId }).lean();
  const user = await User.findById(userId).lean();
  if (!companion || !user) {
    return {
      totalIncome: 0,
      availableBalance: 0,
      holdAmount: 0,
      acceptedBookings: 0,
      completedBookings: 0,
    };
  }

  const bookings = await Booking.find({ companion: companion._id }).lean();
  let totalIncome = 0n;
  let holdAmount = 0n;
  let acceptedBookings = 0;
  let completedBookings = 0;

  for (const b of bookings) {
    const hold = decimal128ToBigInt(b.holdAmount);
    if (b.status === 'COMPLETED') {
      completedBookings += 1;
      totalIncome += hold;
    } else if (b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS') {
      acceptedBookings += 1;
      holdAmount += hold;
    } else if (b.status === 'PENDING') {
      holdAmount += hold;
    }
  }

  return {
    totalIncome: Number(totalIncome),
    availableBalance: decToNumber(user.balance),
    holdAmount: Number(holdAmount),
    acceptedBookings,
    completedBookings,
  };
}

export async function companionPatchBooking(companionDoc, bookingId, body) {
  const status = body?.status;
  if (status === 'ACCEPTED') {
    return workflowBooking(companionDoc._id, bookingId, 'ACCEPT');
  }
  if (status === 'REJECTED') {
    return workflowBooking(companionDoc._id, bookingId, 'REJECT');
  }
  const err = new Error('Chỉ hỗ trợ cập nhật trạng thái ACCEPTED hoặc REJECTED từ PENDING.');
  err.status = 400;
  throw err;
}

export async function companionSos(companionDoc, bookingId, note) {
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    const err = new Error('Không tìm thấy đơn đặt lịch.');
    err.status = 404;
    throw err;
  }
  if (booking.companion.toString() !== companionDoc._id.toString()) {
    const err = new Error('Bạn không thuộc đơn booking này.');
    err.status = 403;
    throw err;
  }
  booking.sosTriggered = true;
  booking.sosNote = note ? String(note).trim().slice(0, 2000) : '';
  await booking.save();
  return serializeBooking(booking);
}

export async function decideBookingExtension(companionUserId, bookingId, decision) {
  const action = decision === 'ACCEPT' ? 'ACCEPT' : 'REJECT';
  return companionDecideExtension(companionUserId, bookingId, action);
}

export function toCompanionProfileJson(doc) {
  const c = doc.toObject ? doc.toObject() : { ...doc };
  const o = { ...c };
  o.id = String(c._id);
  if (c.pricePerHour != null && typeof c.pricePerHour === 'object' && c.pricePerHour.toString) {
    o.pricePerHour = c.pricePerHour.toString();
  }
  if (c.user && c.user._id) {
    o.userId = String(c.user._id);
  }
  delete o.__v;
  return o;
}

const PROFILE_FIELDS = [
  'bio',
  'hobbies',
  'appearance',
  'availability',
  'serviceType',
  'area',
  'rentalVenues',
  'gender',
  'gameRank',
  'onlineStatus',
];

export async function updateCompanionProfile(companionDoc, body) {
  for (const key of PROFILE_FIELDS) {
    if (body[key] === undefined) continue;
    if (key === 'onlineStatus') {
      companionDoc.onlineStatus = Boolean(body.onlineStatus === true || body.onlineStatus === 'true');
    } else {
      const v = body[key];
      companionDoc[key] = v == null ? undefined : String(v).trim() || undefined;
    }
  }
  await companionDoc.save();
  return toCompanionProfileJson(companionDoc);
}

export async function updateCompanionMediaSkills(companionDoc, body) {
  if (body.introMediaUrls !== undefined) {
    companionDoc.introMediaUrls = body.introMediaUrls == null ? undefined : String(body.introMediaUrls).trim();
  }
  if (body.skills !== undefined) {
    companionDoc.skills = body.skills == null ? undefined : String(body.skills).trim();
  }
  await companionDoc.save();
  return toCompanionProfileJson(companionDoc);
}

export async function setCompanionOnline(companionDoc, online) {
  companionDoc.onlineStatus = Boolean(online);
  await companionDoc.save();
  return toCompanionProfileJson(companionDoc);
}

export async function listConsultations(companionDoc) {
  const rows = await Consultation.find({ companion: companionDoc._id })
    .populate('customer', 'username fullName')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return rows.map((c) => ({
    id: String(c._id),
    question: c.question,
    answer: c.answer,
    status: c.status,
    createdAt: c.createdAt,
    answeredAt: c.answeredAt,
    customer: c.customer
      ? {
          id: String(c.customer._id),
          username: c.customer.username,
          fullName: c.customer.fullName,
        }
      : null,
  }));
}

export async function answerConsultation(companionDoc, consultationId, answer) {
  const text = answer == null ? '' : String(answer).trim();
  if (!text) {
    const err = new Error('Nội dung trả lời không được để trống.');
    err.status = 400;
    throw err;
  }
  const c = await Consultation.findOne({ _id: consultationId, companion: companionDoc._id });
  if (!c) {
    const err = new Error('Không tìm thấy câu hỏi tư vấn.');
    err.status = 404;
    throw err;
  }
  c.answer = text;
  c.status = 'ANSWERED';
  c.answeredAt = new Date();
  await c.save();
  return c;
}

export async function listWithdrawals(companionDoc) {
  const rows = await Withdrawal.find({ companion: companionDoc._id }).sort({ createdAt: -1 }).limit(100).lean();
  return rows.map((w) => ({
    id: String(w._id),
    createdAt: w.createdAt,
    amount: decToNumber(w.amount),
    bankName: w.bankName,
    status: w.status,
    commissionAmount: null,
    netAmount: null,
  }));
}

export async function createWithdrawal(companionDoc, body) {
  const amount = Number(body?.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error('Số tiền rút không hợp lệ.');
    err.status = 400;
    throw err;
  }
  if (!companionDoc.payoutBankName || !companionDoc.payoutBankAccountNumber || !companionDoc.payoutAccountHolderName) {
    const err = new Error('Vui lòng cập nhật tài khoản ngân hàng nhận tiền trước khi rút.');
    err.status = 400;
    throw err;
  }
  await Withdrawal.create({
    companion: companionDoc._id,
    amount: bigIntToDecimal128(BigInt(Math.floor(amount))),
    bankName: companionDoc.payoutBankName,
    bankAccountNumber: companionDoc.payoutBankAccountNumber,
    accountHolderName: companionDoc.payoutAccountHolderName,
    status: 'PENDING',
  });
  return true;
}

export function getBankAccount(companionDoc) {
  return {
    bankName: companionDoc.payoutBankName || '',
    bankAccountNumber: companionDoc.payoutBankAccountNumber || '',
    accountHolderName: companionDoc.payoutAccountHolderName || '',
  };
}

export async function updateBankAccount(companionDoc, body) {
  companionDoc.payoutBankName = body.bankName != null ? String(body.bankName).trim().slice(0, 100) : undefined;
  companionDoc.payoutBankAccountNumber =
    body.bankAccountNumber != null ? String(body.bankAccountNumber).trim().slice(0, 30) : undefined;
  companionDoc.payoutAccountHolderName =
    body.accountHolderName != null ? String(body.accountHolderName).trim().slice(0, 100) : undefined;
  await companionDoc.save();
  return getBankAccount(companionDoc);
}
