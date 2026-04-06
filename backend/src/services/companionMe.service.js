import mongoose from 'mongoose';
import Booking from '../models/booking.model.js';
import Companion from '../models/companion.model.js';
import User from '../models/user.model.js';
import Consultation from '../models/consultation.model.js';
import Withdrawal from '../models/withdrawal.model.js';
import WalletTransaction from '../models/walletTransaction.model.js';
import PlatformSettings from '../models/platformSettings.model.js';
import { serializeBooking, workflowBooking, companionDecideExtension } from './booking.service.js';
import { bigIntToDecimal128, decimal128ToBigInt } from '../utils/money.util.js';

function decToNumber(d) {
  if (d == null) return 0;
  const str = typeof d === 'object' && d.toString === 'function' ? d.toString() : String(d);
  return Math.round(Number(str) || 0);
}

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

export async function listCompanionBookings(userId) {
  const companion = await Companion.findOne({ user: userId }).lean();
  if (!companion) return [];
  const settings = await getOrCreateSettings();
  const rate = Number(settings.commissionRate ?? 0.15);

  const rows = await Booking.find({ companion: companion._id })
    .populate('customer', 'username fullName')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  const bookingIds = rows.map((b) => b?._id).filter(Boolean);
  const payoutRows =
    bookingIds.length > 0
      ? await WalletTransaction.find({
          user: userId,
          booking: { $in: bookingIds },
          type: 'PAYOUT',
        })
          .select('booking createdAt amount')
          .sort({ createdAt: -1 })
          .lean()
      : [];
  const payoutByBookingId = new Map(
    payoutRows
      .filter((t) => t?.booking)
      .map((t) => [
        String(t.booking),
        {
          id: String(t._id),
          createdAt: t.createdAt,
          amount: decToNumber(t.amount),
        },
      ])
  );

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

    const gross = decimal128ToBigInt(b.holdAmount);
    const commissionBp = BigInt(Math.max(0, Math.round(rate * 10000)));
    const payout = payoutByBookingId.get(String(b._id)) || null;
    const netFromTxn = payout?.amount != null ? BigInt(Math.max(0, Math.floor(Number(payout.amount)))) : null;
    const computedCommission = (gross * commissionBp + 5000n) / 10000n; // round half up (basis points)
    const computedNet = gross > computedCommission ? gross - computedCommission : 0n;

    // Ưu tiên số liệu thực tế từ giao dịch ví (nếu có), để tránh lệch khi cấu hình thay đổi theo thời điểm.
    const net = netFromTxn != null ? (netFromTxn > 0n ? netFromTxn : 0n) : computedNet;
    const commission = netFromTxn != null ? (gross > net ? gross - net : 0n) : computedCommission;

    o.pricing = {
      currency: 'VND',
      grossAmount: gross.toString(),
      commissionRate: rate,
      commissionAmount: commission.toString(),
      netAmount: net.toString(),
      payout,
    };

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
  // Khi companion chỉnh sửa hồ sơ → yêu cầu admin duyệt lại.
  if (companionDoc.status === 'APPROVED') {
    companionDoc.status = 'PENDING';
    companionDoc.onlineStatus = false;
  }
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
  // Cập nhật media/kỹ năng cũng cần duyệt lại.
  if (companionDoc.status === 'APPROVED') {
    companionDoc.status = 'PENDING';
    companionDoc.onlineStatus = false;
  }
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
  const settings = await getOrCreateSettings();
  const rate = settings.commissionRate ?? 0.15;
  const rows = await Withdrawal.find({ companion: companionDoc._id }).sort({ createdAt: -1 }).limit(100).lean();
  return rows.map((w) => ({
    id: String(w._id),
    createdAt: w.createdAt,
    amount: decToNumber(w.amount),
    bankName: w.bankName,
    status: w.status,
    commissionAmount: Math.round(decToNumber(w.amount) * rate),
    netAmount: Math.max(0, decToNumber(w.amount) - Math.round(decToNumber(w.amount) * rate)),
  }));
}

export async function createWithdrawal(companionDoc, body) {
  const amountNum = Number(body?.amount);
  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    const err = new Error('Số tiền rút không hợp lệ.');
    err.status = 400;
    throw err;
  }
  const amount = BigInt(Math.floor(amountNum));
  if (amount <= 0n) {
    const err = new Error('Số tiền rút không hợp lệ.');
    err.status = 400;
    throw err;
  }
  if (!companionDoc.payoutBankName || !companionDoc.payoutBankAccountNumber || !companionDoc.payoutAccountHolderName) {
    const err = new Error('Vui lòng cập nhật tài khoản ngân hàng nhận tiền trước khi rút.');
    err.status = 400;
    throw err;
  }

  const companionUserId = companionDoc.user;
  if (!companionUserId) {
    const err = new Error('Không tìm thấy tài khoản user của companion.');
    err.status = 500;
    throw err;
  }

  async function createWithdrawalNoTxn() {
    const pending = await Withdrawal.countDocuments({ companion: companionDoc._id, status: 'PENDING' });
    if (pending > 0) {
      const err = new Error('Bạn đang có lệnh rút tiền chờ duyệt. Vui lòng chờ admin xử lý.');
      err.status = 400;
      err.code = 'PENDING_WITHDRAWAL_EXISTS';
      throw err;
    }

    const user = await User.findById(companionUserId);
    if (!user) {
      const err = new Error('Không tìm thấy người dùng.');
      err.status = 404;
      throw err;
    }
    const bal = decimal128ToBigInt(user.balance);
    if (bal < amount) {
      const err = new Error('Số dư ví không đủ để rút.');
      err.status = 400;
      err.code = 'INSUFFICIENT_BALANCE';
      throw err;
    }

    user.balance = bigIntToDecimal128(bal - amount);
    await user.save();

    const w = await Withdrawal.create({
      companion: companionDoc._id,
      amount: bigIntToDecimal128(amount),
      bankName: companionDoc.payoutBankName,
      bankAccountNumber: companionDoc.payoutBankAccountNumber,
      accountHolderName: companionDoc.payoutAccountHolderName,
      status: 'PENDING',
    });

    await WalletTransaction.create({
      user: companionUserId,
      amount: bigIntToDecimal128(amount),
      type: 'CHARGE',
      provider: 'WITHDRAWAL',
      description: `Tạo lệnh rút tiền #${String(w._id)}`,
    });

    return true;
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const pending = await Withdrawal.countDocuments({ companion: companionDoc._id, status: 'PENDING' }).session(session);
    if (pending > 0) {
      const err = new Error('Bạn đang có lệnh rút tiền chờ duyệt. Vui lòng chờ admin xử lý.');
      err.status = 400;
      err.code = 'PENDING_WITHDRAWAL_EXISTS';
      throw err;
    }

    const user = await User.findById(companionUserId).session(session);
    if (!user) {
      const err = new Error('Không tìm thấy người dùng.');
      err.status = 404;
      throw err;
    }

    const bal = decimal128ToBigInt(user.balance);
    if (bal < amount) {
      const err = new Error('Số dư ví không đủ để rút.');
      err.status = 400;
      err.code = 'INSUFFICIENT_BALANCE';
      throw err;
    }

    user.balance = bigIntToDecimal128(bal - amount);
    await user.save({ session });

    const [w] = await Withdrawal.create(
      [
        {
          companion: companionDoc._id,
          amount: bigIntToDecimal128(amount),
          bankName: companionDoc.payoutBankName,
          bankAccountNumber: companionDoc.payoutBankAccountNumber,
          accountHolderName: companionDoc.payoutAccountHolderName,
          status: 'PENDING',
        },
      ],
      { session }
    );

    await WalletTransaction.create(
      [
        {
          user: companionUserId,
          amount: bigIntToDecimal128(amount),
          type: 'CHARGE',
          provider: 'WITHDRAWAL',
          description: `Tạo lệnh rút tiền #${String(w._id)}`,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    return true;
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (_) {}
    if (isTxnUnsupported(err)) {
      return await createWithdrawalNoTxn();
    }
    throw err;
  } finally {
    session.endSession();
  }
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
