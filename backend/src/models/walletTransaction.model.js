import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    booking: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    amount: {
      type: mongoose.Schema.Types.Decimal128,
      required: true,
    },
    type: {
      type: String,
      enum: ['DEPOSIT', 'HOLD', 'REFUND', 'CHARGE', 'PAYOUT'],
      required: true,
    },
    provider: {
      type: String,
      maxlength: 255,
    },
    description: {
      type: String,
      maxlength: 500,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // chỉ tạo createdAt giống LocalDateTime.now()
  }
);

const WalletTransaction = mongoose.model('WalletTransaction', walletTransactionSchema);

export default WalletTransaction;
