import { isCloudinaryConfigured } from '../config/cloudinary.config.js';
import { uploadBufferToCloudinary } from '../utils/cloudinaryUpload.util.js';
import path from 'path';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import crypto from 'crypto';

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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function extFromMime(mime) {
  const m = String(mime || '').toLowerCase();
  if (m === 'image/jpeg' || m === 'image/jpg') return '.jpg';
  if (m === 'image/png') return '.png';
  if (m === 'image/webp') return '.webp';
  if (m === 'image/heic') return '.heic';
  if (m === 'image/heif') return '.heif';
  if (m === 'video/mp4') return '.mp4';
  if (m === 'video/webm') return '.webm';
  if (m === 'video/quicktime') return '.mov';
  return '';
}

async function saveBufferToUploads(buffer, { subdir, mime }) {
  const safeDir = String(subdir || '').replace(/[^a-zA-Z0-9/_-]+/g, '_');
  const ext = extFromMime(mime) || '.bin';
  const name = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`;
  const uploadsRoot = path.join(__dirname, '..', '..', 'uploads');
  const outDir = path.join(uploadsRoot, safeDir);
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, name);
  await fs.writeFile(outPath, buffer);
  // URL được serve bởi backend/server.js: app.use('/uploads', static(...))
  return `/uploads/${safeDir}/${name}`.replace(/\\/g, '/');
}

export const updateIdentity = async (req, res) => {
  try {
    const { identityNumber } = req.body;
    const files = req.files || {};
    const idImg = files.identityImage?.[0];
    const avatar = files.avatar?.[0];
    const cover = files.cover?.[0];
    const video = files.introVideo?.[0];
    const introMediaList = Array.isArray(files.introMedia) ? files.introMedia : [];

    const hasCoreFiles = Boolean(idImg || avatar || cover || video);
    const hasIntroAlbumFiles = introMediaList.length > 0;
    const hasFiles = hasCoreFiles || hasIntroAlbumFiles;
    const hasIdentityField = identityNumber !== undefined;
    const hasIntroUrlsField = req.body.introMediaUrls !== undefined;

    const needsCloudinary = hasCoreFiles || hasIntroAlbumFiles;

    const useCloudinary = needsCloudinary && isCloudinaryConfigured();

    if (!hasFiles && !hasIdentityField && !hasIntroUrlsField) {
      return res.status(400).json({
        message:
          'Cần gửi ít nhất một file (ảnh CCCD, ảnh đại diện, video giới thiệu, album), trường identityNumber, hoặc introMediaUrls.',
      });
    }

    const companion = req.companion;
    const baseFolder = `companion_booking/${companion._id}`;

    if (idImg) {
      if (useCloudinary) {
        const r = await uploadBufferToCloudinary(idImg.buffer, {
          folder: `${baseFolder}/cccd`,
          resourceType: 'image',
        });
        companion.identityImageUrl = r.secure_url;
      } else {
        companion.identityImageUrl = await saveBufferToUploads(idImg.buffer, {
          subdir: `${baseFolder}/cccd`,
          mime: idImg.mimetype,
        });
      }
    }
    if (avatar) {
      if (useCloudinary) {
        const r = await uploadBufferToCloudinary(avatar.buffer, {
          folder: `${baseFolder}/avatar`,
          resourceType: 'image',
        });
        companion.portraitImageUrl = r.secure_url;
        companion.avatarUrl = r.secure_url;
      } else {
        const url = await saveBufferToUploads(avatar.buffer, {
          subdir: `${baseFolder}/avatar`,
          mime: avatar.mimetype,
        });
        companion.portraitImageUrl = url;
        companion.avatarUrl = url;
      }
    }
    if (cover) {
      if (useCloudinary) {
        const r = await uploadBufferToCloudinary(cover.buffer, {
          folder: `${baseFolder}/cover`,
          resourceType: 'image',
        });
        companion.coverImageUrl = r.secure_url;
      } else {
        companion.coverImageUrl = await saveBufferToUploads(cover.buffer, {
          subdir: `${baseFolder}/cover`,
          mime: cover.mimetype,
        });
      }
    }
    if (video) {
      if (useCloudinary) {
        const r = await uploadBufferToCloudinary(video.buffer, {
          folder: `${baseFolder}/intro_video`,
          resourceType: 'video',
        });
        companion.introVideoUrl = r.secure_url;
      } else {
        companion.introVideoUrl = await saveBufferToUploads(video.buffer, {
          subdir: `${baseFolder}/intro_video`,
          mime: video.mimetype,
        });
      }
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
        if (useCloudinary) {
          const r = await uploadBufferToCloudinary(f.buffer, {
            folder: `${baseFolder}/intro_media`,
            resourceType,
          });
          uploadedIntroUrls.push(r.secure_url);
        } else {
          uploadedIntroUrls.push(
            await saveBufferToUploads(f.buffer, { subdir: `${baseFolder}/intro_media`, mime: f.mimetype })
          );
        }
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
