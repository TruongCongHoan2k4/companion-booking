import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  companion: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Companion',
    required: true,
  },
  bookingTime: {
    type: Date,
    required: true,
  },
  duration: {
    type: Number, // in minutes
    required: true,
  },
  location: {
    type: String,
    maxlength: 255,
  },
  rentalVenue: {
    type: String,
    maxlength: 500,
  },
  serviceName: {
    type: String,
    maxlength: 120,
  },
  servicePricePerHour: {
    type: mongoose.Schema.Types.Decimal128,
  },
  note: {
    type: String,
  },
  holdAmount: {
    type: mongoose.Schema.Types.Decimal128,
    default: 0,
  },
  status: {
    type: String,
    enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'],
    default: 'PENDING',
  },
  acceptedAt: Date,
  startedAt: Date,
  completedAt: Date,
  /** Tổng số phút gia hạn đã được duyệt cho booking (từ companion). */
  extensionMinutesApproved: {
    type: Number,
    default: 0,
  },
  /** Số phút khách đang xin gia hạn (chờ companion duyệt). */
  pendingExtensionMinutes: {
    type: Number,
  },
  extensionRequestedAt: Date,
  sosTriggered: {
    type: Boolean,
    default: false,
  },
  sosNote: String,
  companionRatingForUser: Number,
  companionReviewForUser: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const Booking = mongoose.model('Booking', bookingSchema);

export default Booking;
