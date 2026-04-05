import mongoose from 'mongoose';

const passwordResetOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    secret: {
      type: String,
      required: true,
    },
    /** HOTP counter cố định mỗi lần gửi (secret mới mỗi lần). */
    hotpCounter: {
      type: Number,
      default: 1,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

passwordResetOtpSchema.index({ email: 1 }, { unique: true });

const PasswordResetOtp = mongoose.model('PasswordResetOtp', passwordResetOtpSchema);

export default PasswordResetOtp;
