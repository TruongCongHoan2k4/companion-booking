import * as authService from '../services/auth.service.js';
import * as passwordResetService from '../services/passwordReset.service.js';
import { expiresInToMs } from '../utils/jwtCookieUtil.js';

const COOKIE_NAME = 'accessToken';

function setAuthCookie(res, token, expiresIn) {
  const maxAge = expiresInToMs(expiresIn);
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge,
    path: '/',
  });
}

export const register = async (req, res) => {
  try {
    const user = await authService.register(req.body);
    res.status(201).json({ success: true, message: 'Đăng ký thành công.', user });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Đăng ký thất bại.' });
  }
};

export const login = async (req, res) => {
  try {
    const { user, token, expiresIn } = await authService.login(req.body);
    setAuthCookie(res, token, expiresIn);

    res.json({
      success: true,
      message: 'Đăng nhập thành công.',
      user,
      token,
    });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Đăng nhập thất bại.' });
  }
};

export const me = async (req, res) => {
  try {
    const payload = await authService.getMePayload(req.auth.userId);
    res.json(payload);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Không lấy được thông tin tài khoản.' });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    await passwordResetService.requestForgotPassword(req.body.email);
    res.json({
      message: 'Nếu email đã đăng ký, bạn sẽ nhận được mã OTP (kiểm tra hộp thư hoặc log server nếu chưa cấu hình SMTP).',
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Gửi OTP thất bại.' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    await passwordResetService.resetPasswordWithOtp(req.body);
    res.json({ message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập.' });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({ message: err.message || 'Đặt lại mật khẩu thất bại.' });
  }
};

export const logout = async (req, res) => {
  try {
    const isProd = process.env.NODE_ENV === 'production';
    res.clearCookie(COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
    });
    res.json({ message: 'Đã đăng xuất.' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Đăng xuất thất bại.' });
  }
};
