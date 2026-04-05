import mongoose from 'mongoose';

const favoriteSchema = new mongoose.Schema(
  {
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
  },
  {
    timestamps: { createdAt: true, updatedAt: false }, // chỉ tạo createdAt giống LocalDateTime.now()
  }
);

const Favorite = mongoose.model('Favorite', favoriteSchema);

export default Favorite;
