import Joi from 'joi';

export const reportCreateSchema = Joi.object({
  // Bắt buộc tố cáo theo đơn để phục vụ hoàn tiền/thanh toán.
  bookingId: Joi.string().trim().length(24).required(),
  reason: Joi.string().trim().max(2000).required(),
  category: Joi.string().trim().max(50).allow('', null).optional(),
  emergency: Joi.boolean().optional(),
  // Không cho client tự chỉ định người bị tố cáo; server sẽ suy ra từ booking.
  reportedUserId: Joi.any().strip(),
  reporterLatitude: Joi.number().allow(null).optional(),
  reporterLongitude: Joi.number().allow(null).optional(),
});

