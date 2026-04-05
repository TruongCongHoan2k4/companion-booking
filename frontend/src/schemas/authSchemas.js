import { z } from 'zod';

/** Khớp rule Joi backend: registerSchema */
export const registerSchema = z.object({
  username: z.string().trim().min(3, 'Tên đăng nhập ít nhất 3 ký tự').max(50),
  password: z.string().min(8, 'Mật khẩu ít nhất 8 ký tự').max(128),
  email: z.string().trim().email('Email không hợp lệ').max(255),
  fullName: z.string().trim().max(120).optional(),
  phoneNumber: z.string().trim().max(20).optional(),
  role: z.enum(['CUSTOMER', 'COMPANION']),
});

/** Khớp rule Joi backend: loginSchema */
export const loginSchema = z.object({
  username: z.string().trim().min(1, 'Nhập tên đăng nhập').max(50),
  password: z.string().min(1, 'Nhập mật khẩu').max(128),
});
