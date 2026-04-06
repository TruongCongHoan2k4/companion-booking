import mongoose from 'mongoose';
import User from '../models/user.model.js';
import WalletTransaction from '../models/walletTransaction.model.js';
import Notification from '../models/notification.model.js';
import { publishNotification } from '../realtime/realtimeBroadcastService.js';
import UserWithdrawal from '../models/userWithdrawal.model.js';
import { bigIntToDecimal128, decimal128ToBigInt } from '../utils/money.util.js';
import { notifyWalletMutation } from './walletNotify.service.js';

function isTxnUnsupported(err) {
  const msg = String(err?.message || '');
  return (
    msg.includes('Transaction numbers are only allowed on a replica set member or mongos') ||
    msg.includes('replica set') ||
    msg.includes('mongos')
  );
}

export async function getWalletMe(userId) {
  const user = await User.findById(userId).lean();
  if (!user) {
    const err = new Error('Không tìm thấy người dùng.');
    err.status = 404;
    throw err;
  }
  const bal = user.balance != null && user.balance.toString ? user.balance.toString() : '0';
  const txs = await WalletTransaction.find({ user: userId })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  const items = txs.map((t) => {
    const raw = t.amount != null && t.amount.toString ? t.amount.toString() : String(t.amount);
    const abs = BigInt((raw || '0').split('.')[0] || '0');
    const negativeTypes = new Set(['HOLD', 'CHARGE']);
    const signed = negativeTypes.has(t.type) ? -abs : abs;
    return {
      ...t,
      amount: signed.toString(),
      amountAbs: abs.toString(),
    };
  });
  // Backward-compatible: một số UI cũ đọc field `balance`
  return { walletBalance: bal, balance: bal, transactions: items };
}

export async function deposit(userId, amount, provider) {
  const amt = BigInt(Math.floor(Number(amount)));
  if (amt <= 0n) {
    const err = new Error('Số tiền không hợp lệ.');
    err.status = 400;
    throw err;
  }
  const prov = provider == null ? '' : String(provider).trim();

  async function depositNoTxn() {
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('Không tìm thấy người dùng.');
      err.status = 404;
      throw err;
    }
    const bal = decimal128ToBigInt(user.balance);
    const newBal = bal + amt;
    user.balance = bigIntToDecimal128(newBal);
    await user.save();

    await WalletTransaction.create({
      user: userId,
      amount: bigIntToDecimal128(amt),
      type: 'DEPOSIT',
      provider: prov || undefined,
      description: 'Nạp tiền vào ví',
    });

    const n = await Notification.create({
      user: userId,
      title: 'Nạp tiền thành công',
      content: `Bạn đã nạp ${Number(amt).toLocaleString('vi-VN')} ₫ vào ví.`,
      isRead: false,
    });
    const full = await Notification.findById(n._id).populate('user');
    publishNotification(full);

    return { walletBalance: newBal.toString() };
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findById(userId).session(session);
    if (!user) {
      const err = new Error('Không tìm thấy người dùng.');
      err.status = 404;
      throw err;
    }

    const bal = decimal128ToBigInt(user.balance);
    const newBal = bal + amt;
    user.balance = bigIntToDecimal128(newBal);
    await user.save({ session });

    await WalletTransaction.create(
      [
        {
          user: userId,
          amount: bigIntToDecimal128(amt),
          type: 'DEPOSIT',
          provider: prov || undefined,
          description: 'Nạp tiền vào ví',
        },
      ],
      { session }
    );

    // notification (out of transaction is ok for dev; keep it simple)
    const n = await Notification.create({
      user: userId,
      title: 'Nạp tiền thành công',
      content: `Bạn đã nạp ${Number(amt).toLocaleString('vi-VN')} ₫ vào ví.`,
      isRead: false,
    });
    const full = await Notification.findById(n._id).populate('user');
    publishNotification(full);

    await session.commitTransaction();
    return { walletBalance: newBal.toString() };
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (_) {}
    if (isTxnUnsupported(err)) {
      return await depositNoTxn();
    }
    throw err;
  } finally {
    session.endSession();
  }
}

export async function listMyWithdrawals(userId) {
  const rows = await UserWithdrawal.find({ user: userId }).sort({ createdAt: -1 }).limit(50).lean();
  return rows.map((w) => ({
    id: String(w._id),
    amount: w.amount != null && w.amount.toString ? w.amount.toString() : String(w.amount || 0),
    bankName: w.bankName,
    bankAccountNumber: w.bankAccountNumber,
    accountHolderName: w.accountHolderName,
    status: w.status,
    createdAt: w.createdAt,
  }));
}

export async function withdrawRequest(userId, body) {
  const amt = BigInt(Math.floor(Number(body?.amount)));
  if (amt <= 0n) {
    const err = new Error('Số tiền rút không hợp lệ.');
    err.status = 400;
    throw err;
  }
  const bankName = String(body?.bankName || '').trim();
  const bankAccountNumber = String(body?.bankAccountNumber || '').trim();
  const accountHolderName = String(body?.accountHolderName || '').trim();
  if (!bankName || !bankAccountNumber || !accountHolderName) {
    const err = new Error('Vui lòng nhập đầy đủ thông tin tài khoản ngân hàng.');
    err.status = 400;
    throw err;
  }

  async function withdrawNoTxn() {
    const user = await User.findById(userId);
    if (!user) {
      const err = new Error('Không tìm thấy người dùng.');
      err.status = 404;
      throw err;
    }
    const bal = decimal128ToBigInt(user.balance);
    if (bal < amt) {
      const err = new Error('Số dư ví không đủ để rút.');
      err.status = 400;
      err.code = 'INSUFFICIENT_BALANCE';
      throw err;
    }
    user.balance = bigIntToDecimal128(bal - amt);
    await user.save();

    const w = await UserWithdrawal.create({
      user: userId,
      amount: bigIntToDecimal128(amt),
      bankName,
      bankAccountNumber,
      accountHolderName,
      status: 'PENDING',
    });

    await WalletTransaction.create({
      user: userId,
      amount: bigIntToDecimal128(amt),
      type: 'CHARGE',
      provider: 'USER_WITHDRAWAL',
      description: `Tạo lệnh rút tiền #${String(w._id)}`,
    });

    void notifyWalletMutation({
      userId,
      type: 'CHARGE',
      amountVnd: amt,
      provider: 'USER_WITHDRAWAL',
      description: `Tạo lệnh rút tiền #${String(w._id)}`,
    });

    return { id: String(w._id) };
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findById(userId).session(session);
    if (!user) {
      const err = new Error('Không tìm thấy người dùng.');
      err.status = 404;
      throw err;
    }
    const bal = decimal128ToBigInt(user.balance);
    if (bal < amt) {
      const err = new Error('Số dư ví không đủ để rút.');
      err.status = 400;
      err.code = 'INSUFFICIENT_BALANCE';
      throw err;
    }
    user.balance = bigIntToDecimal128(bal - amt);
    await user.save({ session });

    const [w] = await UserWithdrawal.create(
      [
        {
          user: userId,
          amount: bigIntToDecimal128(amt),
          bankName,
          bankAccountNumber,
          accountHolderName,
          status: 'PENDING',
        },
      ],
      { session }
    );

    await WalletTransaction.create(
      [
        {
          user: userId,
          amount: bigIntToDecimal128(amt),
          type: 'CHARGE',
          provider: 'USER_WITHDRAWAL',
          description: `Tạo lệnh rút tiền #${String(w._id)}`,
        },
      ],
      { session }
    );

    void notifyWalletMutation({
      userId,
      type: 'CHARGE',
      amountVnd: amt,
      provider: 'USER_WITHDRAWAL',
      description: `Tạo lệnh rút tiền #${String(w._id)}`,
    });

    await session.commitTransaction();
    return { id: String(w._id) };
  } catch (err) {
    try {
      await session.abortTransaction();
    } catch (_) {}
    if (isTxnUnsupported(err)) {
      return await withdrawNoTxn();
    }
    throw err;
  } finally {
    session.endSession();
  }
}
