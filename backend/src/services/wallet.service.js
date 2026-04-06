import mongoose from 'mongoose';
import User from '../models/user.model.js';
import WalletTransaction from '../models/walletTransaction.model.js';
import { bigIntToDecimal128, decimal128ToBigInt } from '../utils/money.util.js';

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
  const items = txs.map((t) => ({
    ...t,
    amount: t.amount != null && t.amount.toString ? t.amount.toString() : String(t.amount),
  }));
  return { walletBalance: bal, transactions: items };
}

export async function depositMock(userId, amount) {
  const amt = BigInt(Math.floor(Number(amount)));
  if (amt <= 0n) {
    const err = new Error('Số tiền không hợp lệ.');
    err.status = 400;
    throw err;
  }

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
      provider: 'MOCK',
      description: 'Nạp tiền (mock, cộng trực tiếp số dư)',
    });

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
          provider: 'MOCK',
          description: 'Nạp tiền (mock, cộng trực tiếp số dư)',
        },
      ],
      { session }
    );

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
