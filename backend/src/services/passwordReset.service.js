import bcrypt from 'bcryptjs';
import { OTP } from 'otplib';
import User from '../models/user.model.js';
import PasswordResetOtp from '../models/passwordResetOtp.model.js';
import { sendPasswordResetOtpEmail } from './email.service.js';

const hotp = new OTP({ strategy: 'hotp' });
const HOTP_COUNTER = 1;
const SALT_ROUNDS = 12;

const OTP_EXPIRE_MS = () =>
  (Number(process.env.OTP_EXPIRE_MINUTES) || 15) * 60 * 1000;

export async function requestForgotPassword(emailRaw) {
  const email = String(emailRaw || '').trim().toLowerCase();
  if (!email) {
    return { ok: true };
  }

  const user = await User.findOne({ email });
  if (!user) {
    return { ok: true };
  }

  const secret = hotp.generateSecret();
  const otp = hotp.generateSync({ secret, counter: HOTP_COUNTER });
  const expiresAt = new Date(Date.now() + OTP_EXPIRE_MS());

  await PasswordResetOtp.findOneAndUpdate(
    { email },
    { email, secret, hotpCounter: HOTP_COUNTER, expiresAt },
    { upsert: true, new: true }
  );

  await sendPasswordResetOtpEmail(email, otp);
  return { ok: true };
}

export async function resetPasswordWithOtp({ email, otp, newPassword }) {
  const emailNorm = String(email || '').trim().toLowerCase();
  const otpTrim = String(otp || '').trim();

  const doc = await PasswordResetOtp.findOne({ email: emailNorm });
  if (!doc || doc.expiresAt < new Date()) {
    const err = new Error('Mã OTP không hợp lệ hoặc đã hết hạn.');
    err.status = 400;
    throw err;
  }

  const result = hotp.verifySync({
    secret: doc.secret,
    token: otpTrim,
    counter: doc.hotpCounter ?? HOTP_COUNTER,
  });

  if (!result.valid) {
    const err = new Error('Mã OTP không đúng.');
    err.status = 400;
    throw err;
  }

  const user = await User.findOne({ email: emailNorm }).select('+password');
  if (!user) {
    const err = new Error('Không tìm thấy tài khoản.');
    err.status = 404;
    throw err;
  }

  user.password = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await user.save();
  await PasswordResetOtp.deleteOne({ _id: doc._id });
}
