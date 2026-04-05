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

const fields = [
  { name: 'identityImage', maxCount: 1 },
  { name: 'avatar', maxCount: 1 },
  { name: 'introVideo', maxCount: 1 },
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
    const msg =
      checkSize(files?.identityImage, MAX_IMAGE_BYTES, 'Ảnh CCCD') ||
      checkSize(files?.avatar, MAX_IMAGE_BYTES, 'Ảnh đại diện') ||
      checkSize(files?.introVideo, MAX_VIDEO_BYTES, 'Video giới thiệu');
    if (msg) {
      return res.status(400).json({ message: msg });
    }
    next();
  });
}
