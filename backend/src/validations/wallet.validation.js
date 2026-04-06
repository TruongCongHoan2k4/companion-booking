import Joi from 'joi';

export const walletDepositSchema = Joi.object({
  amount: Joi.number().integer().positive().max(Number.MAX_SAFE_INTEGER).required(),
  provider: Joi.string().trim().max(255).allow('', null).optional(),
});

export const walletWithdrawSchema = Joi.object({
  amount: Joi.number().integer().positive().max(Number.MAX_SAFE_INTEGER).required(),
  bankName: Joi.string().trim().max(100).required(),
  bankAccountNumber: Joi.string().trim().max(30).required(),
  accountHolderName: Joi.string().trim().max(100).required(),
});

