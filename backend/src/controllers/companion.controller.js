import { isCloudinaryConfigured } from '../config/cloudinary.config.js';
import { uploadBufferToCloudinary } from '../utils/cloudinaryUpload.util.js';

function toPlainCompanion(doc) {
  const o = doc.toObject ? doc.toObject() : { ...doc };
  if (o.pricePerHour != null && o.pricePerHour.toString) {
    o.pricePerHour = o.pricePerHour.toString();
  }
  return o;
}

export const updateIdentity = async (req, res) => {
  try {
    const { identityNumber } = req.body;
    const files = req.files || {};
    const idImg = files.identityImage?.[0];
    const avatar = files.avatar?.[0];
    const video = files.introVideo?.[0];

    const hasFiles = Boolean(idImg || avatar || video);
    const hasIdentityField = identityNumber !== undefined;

    if (hasFiles && !isCloudinaryConfigured()) {
      return res.status(503).json({
        message: 'Chưa cấu hình Cloudinary (CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET).',
      });
    }

    if (!hasFiles && !hasIdentityField) {
      return res.status(400).json({
        message:
          'Cần gửi ít nhất một file (ảnh CCCD, ảnh đại diện, video giới thiệu) hoặc trường identityNumber.',
      });
    }

    const companion = req.companion;
    const baseFolder = `companion_booking/${companion._id}`;

    if (idImg) {
      const r = await uploadBufferToCloudinary(idImg.buffer, {
        folder: `${baseFolder}/cccd`,
        resourceType: 'image',
      });
      companion.identityImageUrl = r.secure_url;
    }
    if (avatar) {
      const r = await uploadBufferToCloudinary(avatar.buffer, {
        folder: `${baseFolder}/avatar`,
        resourceType: 'image',
      });
      companion.portraitImageUrl = r.secure_url;
      companion.avatarUrl = r.secure_url;
    }
    if (video) {
      const r = await uploadBufferToCloudinary(video.buffer, {
        folder: `${baseFolder}/intro_video`,
        resourceType: 'video',
      });
      companion.introVideoUrl = r.secure_url;
    }
    if (hasIdentityField) {
      companion.identityNumber = identityNumber ? String(identityNumber).trim() : undefined;
    }

    await companion.save();
    res.json({
      message: 'Cập nhật định danh & media thành công.',
      companion: toPlainCompanion(companion),
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Upload Cloudinary thất bại.' });
  }
};
