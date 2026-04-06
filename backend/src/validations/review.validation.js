import Joi from 'joi';

export const reviewCreateSchema = Joi.object({
  bookingId: Joi.string().trim().length(24).required(),
  rating: Joi.number().integer().min(1).max(5).required(),
  comment: Joi.string().allow('').max(2000).optional(),
});

