import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
    },
    password: {
      type: String,
      required: true,
      select: false, // tương ứng với @JsonIgnore
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    phoneNumber: {
      type: String,
      maxlength: 20,
    },
    fullName: {
      type: String,
    },
    role: {
      type: String,
      enum: ['CUSTOMER', 'COMPANION', 'ADMIN'],
      required: true,
    },
    balance: {
      type: mongoose.Schema.Types.Decimal128,
      default: 0,
    },
    moderationFlag: {
      type: String,
      enum: ['NONE', 'WARNED', 'BANNED'],
      default: 'NONE',
    },
    locked: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // chỉ tạo createdAt giống LocalDateTime.now()
  }
);

const User = mongoose.model('User', userSchema);

export default User;
