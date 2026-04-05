import Joi from 'joi';

export const walletDepositSchema = Joi.object({
  amount: Joi.number().integer().positive().max(Number.MAX_SAFE_INTEGER).required(),
});
