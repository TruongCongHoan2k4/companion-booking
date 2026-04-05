import mongoose from 'mongoose';

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reportedUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    reason: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      maxlength: 50,
    },
    emergency: {
      type: Boolean,
      default: false,
    },
    relatedBookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    reporterLatitude: {
      type: Number,
    },
    reporterLongitude: {
      type: Number,
    },
    status: {
      type: String,
      enum: ['PENDING', 'RESOLVED'],
      default: 'PENDING',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // chỉ tạo createdAt giống LocalDateTime.now()
  }
);

const Report = mongoose.model('Report', reportSchema);

export default Report;
