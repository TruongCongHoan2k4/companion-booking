import Joi from 'joi';

export const createBookingSchema = Joi.object({
  companionId: Joi.string().hex().length(24).required(),
  bookingTime: Joi.date().required(),
  duration: Joi.number().integer().min(15).max(1440).required(),
  location: Joi.string().trim().max(255).allow('', null).optional(),
  rentalVenue: Joi.string().trim().max(500).allow('', null).optional(),
  // Ưu tiên: chọn theo bảng giá của companion
  servicePriceId: Joi.string().hex().length(24).allow('', null).optional(),
  // Tương thích ngược: cho phép gửi thẳng giá/tên dịch vụ (legacy UI).
  serviceName: Joi.string().trim().max(120).allow('', null).optional(),
  servicePricePerHour: Joi.number().positive().max(1e12).optional(),
  note: Joi.string().trim().max(2000).allow('', null).optional(),
});

export const bookingWorkflowSchema = Joi.object({
  action: Joi.string().valid('ACCEPT', 'REJECT').required(),
});

export const bookingExtensionRequestSchema = Joi.object({
  extraMinutes: Joi.number().integer().valid(30).required(),
});
