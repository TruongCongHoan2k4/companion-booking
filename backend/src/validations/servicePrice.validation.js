import Joi from 'joi';

export const servicePriceCreateSchema = Joi.object({
  serviceName: Joi.string().trim().min(1).max(200).required(),
  pricePerHour: Joi.number().positive().max(1e12).required(),
  description: Joi.string().trim().max(2000).allow('', null).optional(),
});

export const servicePriceUpdateSchema = Joi.object({
  serviceName: Joi.string().trim().min(1).max(200),
  pricePerHour: Joi.number().positive().max(1e12),
  description: Joi.string().trim().max(2000).allow('', null),
}).or('serviceName', 'pricePerHour', 'description');

export const identityBodySchema = Joi.object({
  identityNumber: Joi.string().trim().max(30).allow('', null).optional(),
}).unknown(true);
