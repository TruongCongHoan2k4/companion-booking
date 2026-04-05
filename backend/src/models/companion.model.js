import mongoose from 'mongoose';

const companionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bio: {
      type: String,
    },
    hobbies: {
      type: String,
    },
    appearance: {
      type: String,
    },
    availability: {
      type: String,
    },
    serviceType: {
      type: String,
      maxlength: 50,
    },
    area: {
      type: String,
      maxlength: 120,
    },
    rentalVenues: {
      type: String,
    },
    gender: {
      type: String,
      maxlength: 20,
    },
    gameRank: {
      type: String,
      maxlength: 50,
    },
    onlineStatus: {
      type: Boolean,
      default: false,
    },
    pricePerHour: {
      type: mongoose.Schema.Types.Decimal128,
      default: 200000,
    },
    avatarUrl: {
      type: String,
      maxlength: 500,
    },
    introVideoUrl: {
      type: String,
      maxlength: 500,
    },
    identityNumber: {
      type: String,
      maxlength: 30,
    },
    identityImageUrl: {
      type: String,
      maxlength: 500,
    },
    portraitImageUrl: {
      type: String,
      maxlength: 500,
    },
    introMediaUrls: {
      type: String,
    },
    skills: {
      type: String,
    },
    payoutBankName: {
      type: String,
      maxlength: 100,
    },
    payoutBankAccountNumber: {
      type: String,
      maxlength: 30,
    },
    payoutAccountHolderName: {
      type: String,
      maxlength: 100,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED'],
      default: 'PENDING',
    },
  },
  {
    timestamps: true,
  }
);

// Trường transient: responseRate, averageRating, reviewCount có thể tính động, không lưu DB

const Companion = mongoose.model('Companion', companionSchema);

export default Companion;
