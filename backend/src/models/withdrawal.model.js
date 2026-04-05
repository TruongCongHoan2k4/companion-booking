import mongoose from 'mongoose';

const withdrawalSchema = new mongoose.Schema(
  {
    companion: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Companion',
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
    timestamps: { createdAt: true, updatedAt: false }, // chỉ tạo createdAt giống LocalDateTime.now()
  }
);

const Withdrawal = mongoose.model('Withdrawal', withdrawalSchema);

export default Withdrawal;
