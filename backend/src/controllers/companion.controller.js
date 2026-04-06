import { isCloudinaryConfigured } from '../config/cloudinary.config.js';
import { uploadBufferToCloudinary } from '../utils/cloudinaryUpload.util.js';

function parseCommaUrls(value) {
  if (value == null) return [];
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

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
    const introMediaList = Array.isArray(files.introMedia) ? files.introMedia : [];

    const hasCoreFiles = Boolean(idImg || avatar || video);
    const hasIntroAlbumFiles = introMediaList.length > 0;
    const hasFiles = hasCoreFiles || hasIntroAlbumFiles;
    const hasIdentityField = identityNumber !== undefined;
    const hasIntroUrlsField = req.body.introMediaUrls !== undefined;

    const needsCloudinary = hasCoreFiles || hasIntroAlbumFiles;

    if (needsCloudinary && !isCloudinaryConfigured()) {
      return res.status(503).json({
        message: 'Chưa cấu hình Cloudinary (CLOUDINARY_CLOUD_NAME, API_KEY, API_SECRET).',
      });
    }

    if (!hasFiles && !hasIdentityField && !hasIntroUrlsField) {
      return res.status(400).json({
        message:
          'Cần gửi ít nhất một file (ảnh CCCD, ảnh đại diện, video giới thiệu, album), trường identityNumber, hoặc introMediaUrls.',
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

    let retainedIntro = null;
    if (hasIntroUrlsField) {
      retainedIntro = parseCommaUrls(req.body.introMediaUrls);
    }
    const uploadedIntroUrls = [];
    if (introMediaList.length) {
      for (const f of introMediaList) {
        const resourceType = String(f.mimetype || '').startsWith('video/') ? 'video' : 'image';
        const r = await uploadBufferToCloudinary(f.buffer, {
          folder: `${baseFolder}/intro_media`,
          resourceType,
        });
        uploadedIntroUrls.push(r.secure_url);
      }
    }
    if (retainedIntro !== null || uploadedIntroUrls.length) {
      const base =
        retainedIntro !== null ? retainedIntro : parseCommaUrls(companion.introMediaUrls || '');
      companion.introMediaUrls = [...base, ...uploadedIntroUrls].join(',') || undefined;
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
