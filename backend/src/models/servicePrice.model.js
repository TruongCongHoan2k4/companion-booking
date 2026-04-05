import mongoose from 'mongoose';

const servicePriceSchema = new mongoose.Schema(
  {
    serviceName: {
      type: String,
      required: true,
    },
    companion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Companion',
      required: true,
    },
    pricePerHour: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    description: {
      type: String,
    },
  },
  {
    timestamps: true, // tự động tạo createdAt và updatedAt
  }
);

const ServicePrice = mongoose.model('ServicePrice', servicePriceSchema);

export default ServicePrice;
