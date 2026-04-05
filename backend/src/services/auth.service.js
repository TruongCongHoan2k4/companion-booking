import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import Companion from '../models/companion.model.js';

const SALT_ROUNDS = 12;

function toPlainUser(userDoc) {
  const o = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  delete o.password;
  if (o.balance != null && o.balance.toString) {
    o.balance = o.balance.toString();
  }
  return o;
}

export const register = async ({ username, password, email, fullName, phoneNumber, role }) => {
  const existing = await User.findOne({
    $or: [{ username }, { email: email.toLowerCase() }],
  });
  if (existing) {
    const err = new Error('Tên đăng nhập hoặc email đã được sử dụng.');
    err.status = 409;
    throw err;
  }

  const hashed = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({
    username,
    password: hashed,
    email: email.toLowerCase(),
    fullName: fullName || undefined,
    phoneNumber: phoneNumber || undefined,
    role,
  });

  return toPlainUser(user);
};

export const login = async ({ username, password }) => {
  const user = await User.findOne({ username }).select('+password');
  if (!user) {
    const err = new Error('Sai tên đăng nhập hoặc mật khẩu.');
    err.status = 401;
    throw err;
  }

  if (user.locked) {
    const err = new Error('Tài khoản đã bị khóa.');
    err.status = 403;
    throw err;
  }

  const ok = await bcrypt.compare(password, user.password);
  if (!ok) {
    const err = new Error('Sai tên đăng nhập hoặc mật khẩu.');
    err.status = 401;
    throw err;
  }

  const plain = toPlainUser(user);

  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    const err = new Error('ACCESS_TOKEN_SECRET chưa cấu hình.');
    err.status = 500;
    throw err;
  }

  const expiresIn = process.env.ACCESS_TOKEN_EXPIRES || '15m';
  const token = jwt.sign(
    { sub: user._id.toString(), role: user.role },
    secret,
    { expiresIn }
  );

  return { user: plain, token, expiresIn };
};

export const getMePayload = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('Không tìm thấy người dùng.');
    err.status = 404;
    throw err;
  }

  const plainUser = toPlainUser(user);
  let companion = null;

  if (user.role === 'COMPANION') {
    companion = await Companion.findOne({ user: userId }).lean();
    if (companion && companion.pricePerHour != null && companion.pricePerHour.toString) {
      companion.pricePerHour = companion.pricePerHour.toString();
    }
  }

  const userIdStr = user._id.toString();

  return {
    authenticated: true,
    userId: userIdStr,
    username: plainUser.username,
    role: plainUser.role,
    user: plainUser,
    companion,
    isAdmin: user.role === 'ADMIN',
  };
};
