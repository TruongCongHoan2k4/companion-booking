import multer from 'multer';

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_BYTES = 120 * 1024 * 1024;

const IMAGE_MIME = /^image\/(jpeg|jpg|png|webp)$/i;
const VIDEO_MIME = /^video\/(mp4|webm|quicktime)$/i;

function fileFilter(req, file, cb) {
  if (file.fieldname === 'identityImage' || file.fieldname === 'avatar') {
    if (!IMAGE_MIME.test(file.mimetype)) {
      return cb(new Error('Ảnh CCCD/đại diện chỉ chấp nhận JPEG, PNG hoặc WebP.'));
    }
    return cb(null, true);
  }
  if (file.fieldname === 'introMedia') {
    if (IMAGE_MIME.test(file.mimetype) || VIDEO_MIME.test(file.mimetype)) {
      return cb(null, true);
    }
    return cb(new Error('Album chỉ chấp nhận ảnh (JPEG, PNG, WebP) hoặc video (MP4, WebM, MOV).'));
  }
  if (file.fieldname === 'introVideo') {
    if (!VIDEO_MIME.test(file.mimetype)) {
      return cb(new Error('Video giới thiệu chỉ chấp nhận MP4, WebM hoặc MOV.'));
    }
    return cb(null, true);
  }
  return cb(new Error(`Trường file không hợp lệ: ${file.fieldname}`));
}

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_VIDEO_BYTES },
});

const MAX_INTRO_MEDIA = 12;

const fields = [
  { name: 'identityImage', maxCount: 1 },
  { name: 'avatar', maxCount: 1 },
  { name: 'introVideo', maxCount: 1 },
  { name: 'introMedia', maxCount: MAX_INTRO_MEDIA },
];

export function identityUploadMiddleware(req, res, next) {
  upload.fields(fields)(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ message: 'File vượt quá dung lượng cho phép.' });
        }
        return res.status(400).json({ message: err.message });
      }
      return res.status(400).json({ message: err.message || 'Lỗi upload file.' });
    }

    const files = req.files;
    const checkSize = (arr, max, label) => {
      const f = arr?.[0];
      if (f && f.size > max) {
        return `${label} vượt quá ${Math.round(max / (1024 * 1024))}MB.`;
      }
      return null;
    };
    const introList = Array.isArray(files?.introMedia) ? files.introMedia : [];
    let introErr = null;
    for (let i = 0; i < introList.length; i++) {
      const f = introList[i];
      const max = VIDEO_MIME.test(f.mimetype) ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      const label = VIDEO_MIME.test(f.mimetype) ? `Video album #${i + 1}` : `Ảnh album #${i + 1}`;
      if (f.size > max) {
        introErr = `${label} vượt quá ${Math.round(max / (1024 * 1024))}MB.`;
        break;
      }
    }
    const msg =
      checkSize(files?.identityImage, MAX_IMAGE_BYTES, 'Ảnh CCCD') ||
      checkSize(files?.avatar, MAX_IMAGE_BYTES, 'Ảnh đại diện') ||
      checkSize(files?.introVideo, MAX_VIDEO_BYTES, 'Video giới thiệu') ||
      introErr;
    if (msg) {
      return res.status(400).json({ message: msg });
    }
    next();
  });
}
