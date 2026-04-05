import mongoose from 'mongoose';

const companionAvailabilitySchema = new mongoose.Schema(
  {
    companion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Companion',
      required: true,
    },
    startTime: {
      type: Date,
      required: true,
    },
    endTime: {
      type: Date,
      required: true,
    },
    note: {
      type: String,
    },
  },
  {
    timestamps: true, // tự động tạo createdAt và updatedAt
  }
);

const CompanionAvailability = mongoose.model('CompanionAvailability', companionAvailabilitySchema);

export default CompanionAvailability;
