import Joi from 'joi';

export const registerSchema = Joi.object({
  username: Joi.string().trim().min(3).max(50).required(),
  password: Joi.string().min(8).max(128).required(),
  email: Joi.string().email().max(255).required(),
  fullName: Joi.string().trim().max(120).allow('', null).optional(),
  phoneNumber: Joi.string().trim().max(20).allow('', null).optional(),
  role: Joi.string().valid('CUSTOMER', 'COMPANION').required(),
});

export const loginSchema = Joi.object({
  username: Joi.string().trim().min(1).max(50).required(),
  password: Joi.string().min(1).max(128).required(),
});

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().max(255).required(),
});

export const resetPasswordSchema = Joi.object({
  email: Joi.string().email().max(255).required(),
  otp: Joi.string().trim().length(6).pattern(/^\d{6}$/).required(),
  newPassword: Joi.string().min(8).max(128).required(),
});
