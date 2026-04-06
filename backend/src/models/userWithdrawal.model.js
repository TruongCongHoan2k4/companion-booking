import mongoose from 'mongoose';

const userWithdrawalSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    bankName: {
      type: String,
      required: true,
      maxlength: 100,
    },
    bankAccountNumber: {
      type: String,
      required: true,
      maxlength: 30,
    },
    accountHolderName: {
      type: String,
      required: true,
      maxlength: 100,
    },
    status: {
      type: String,
      enum: ['PENDING', 'APPROVED', 'REJECTED', 'PAID'],
      default: 'PENDING',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const UserWithdrawal = mongoose.model('UserWithdrawal', userWithdrawalSchema);

export default UserWithdrawal;

