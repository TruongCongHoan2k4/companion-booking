import { Readable } from 'stream';
import { cloudinary } from '../config/cloudinary.config.js';

/**
 * @param {Buffer} buffer
 * @param {{ folder: string; resourceType?: 'image' | 'video'; publicId?: string }} opts
 */
export function uploadBufferToCloudinary(buffer, opts) {
  const { folder, resourceType = 'image', publicId } = opts;
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: resourceType,
        ...(publicId ? { public_id: publicId } : {}),
        use_filename: true,
        unique_filename: true,
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result);
      }
    );
    Readable.from(buffer).pipe(stream);
  });
}
