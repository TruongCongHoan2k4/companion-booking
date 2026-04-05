import mongoose from 'mongoose';

const { Schema } = mongoose;

const consultationSchema = new Schema(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    companion: {
      type: Schema.Types.ObjectId,
      ref: 'Companion',
      required: true,
    },

    question: {
      type: String,
      required: true,
    },

    answer: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ['PENDING', 'ANSWERED'],
      default: 'PENDING',
      required: true,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },

    answeredAt: {
      type: Date,
      default: null,
    },
  },
  {
    collection: 'consultations',
  }
);

const Consultation = mongoose.model('Consultation', consultationSchema);

export default Consultation;
