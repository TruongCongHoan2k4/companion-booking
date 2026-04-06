import mongoose from 'mongoose';
import ServicePrice from '../models/servicePrice.model.js';

function serialize(doc) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  if (o.pricePerHour != null && o.pricePerHour.toString) {
    o.pricePerHour = o.pricePerHour.toString();
  }
  if (o._id) {
    o.id = String(o._id);
  }
  return o;
}

export const listByCompanion = async (companionId) => {
  const rows = await ServicePrice.find({ companion: companionId }).sort({ createdAt: -1 }).lean();
  return rows.map((r) => serialize(r));
};

export const createForCompanion = async (companionId, { serviceName, pricePerHour, description }) => {
  const doc = await ServicePrice.create({
    companion: companionId,
    serviceName,
    pricePerHour: mongoose.Types.Decimal128.fromString(String(pricePerHour)),
    description: description || undefined,
  });
  return serialize(doc);
};

export const updateForCompanion = async (companionId, servicePriceId, payload) => {
  if (!mongoose.Types.ObjectId.isValid(servicePriceId)) {
    const err = new Error('ID bảng giá không hợp lệ.');
    err.status = 400;
    throw err;
  }

  const doc = await ServicePrice.findOne({
    _id: servicePriceId,
    companion: companionId,
  });
  if (!doc) {
    const err = new Error('Không tìm thấy bảng giá.');
    err.status = 404;
    throw err;
  }

  if (payload.serviceName !== undefined) doc.serviceName = payload.serviceName;
  if (payload.pricePerHour !== undefined) {
    doc.pricePerHour = mongoose.Types.Decimal128.fromString(String(payload.pricePerHour));
  }
  if (payload.description !== undefined) doc.description = payload.description || undefined;

  await doc.save();
  return serialize(doc);
};

export const deleteForCompanion = async (companionId, servicePriceId) => {
  if (!mongoose.Types.ObjectId.isValid(servicePriceId)) {
    const err = new Error('ID bảng giá không hợp lệ.');
    err.status = 400;
    throw err;
  }

  const result = await ServicePrice.deleteOne({
    _id: servicePriceId,
    companion: companionId,
  });
  if (result.deletedCount === 0) {
    const err = new Error('Không tìm thấy bảng giá.');
    err.status = 404;
    throw err;
  }
  return true;
};
