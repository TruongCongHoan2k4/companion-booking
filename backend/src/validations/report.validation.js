import Joi from 'joi';

export const reportCreateSchema = Joi.object({
  reportedUserId: Joi.string().trim().length(24).required(),
  reason: Joi.string().trim().min(4).max(2000).required(),
  category: Joi.string().trim().max(50).allow('', null).optional(),
  emergency: Joi.boolean().optional(),
  bookingId: Joi.string().trim().length(24).allow(null, '').optional(),
  reporterLatitude: Joi.number().allow(null).optional(),
  reporterLongitude: Joi.number().allow(null).optional(),
});

