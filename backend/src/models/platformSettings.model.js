import mongoose from 'mongoose';

const platformSettingsSchema = new mongoose.Schema({
  commissionRate: {
    type: Number,
    default: 0.15,
    min: 0,
    max: 1,
  },
});

const PlatformSettings = mongoose.model('PlatformSettings', platformSettingsSchema);

export default PlatformSettings;
