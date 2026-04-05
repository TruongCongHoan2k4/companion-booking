import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { api } from '../api/client.js';

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp';
const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov';

const MAX_IMAGE = 12 * 1024 * 1024;
const MAX_VIDEO = 120 * 1024 * 1024;

function useObjectPreview(file) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return undefined;
    }
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return url;
}

export default function CompanionIdentityUpload() {
  const [identityNumber, setIdentityNumber] = useState('');
  const [identityImage, setIdentityImage] = useState(null);
  const [avatar, setAvatar] = useState(null);
  const [introVideo, setIntroVideo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const idInput = useRef(null);
  const avInput = useRef(null);
  const vidInput = useRef(null);

  const previewId = useObjectPreview(identityImage);
  const previewAv = useObjectPreview(avatar);
  const previewVid = useObjectPreview(introVideo);

  const validateImage = (file) => {
    if (!file) return null;
    if (!/^image\/(jpeg|jpg|png|webp)$/i.test(file.type)) {
      return 'Ảnh chỉ chấp nhận JPEG, PNG hoặc WebP.';
    }
    if (file.size > MAX_IMAGE) {
      return 'Ảnh không được vượt quá 12MB.';
    }
    return null;
  };

  const validateVideo = (file) => {
    if (!file) return null;
    if (!/^video\/(mp4|webm|quicktime)$/i.test(file.type)) {
      return 'Video chỉ chấp nhận MP4, WebM hoặc MOV.';
    }
    if (file.size > MAX_VIDEO) {
      return 'Video không được vượt quá 120MB.';
    }
    return null;
  };

  const onPick = useCallback((setter, kind) => (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    const err = kind === 'video' ? validateVideo(f) : validateImage(f);
    if (err) {
      toast.error(err);
      return;
    }
    setter(f);
  }, []);

  const resetFiles = () => {
    setIdentityImage(null);
    setAvatar(null);
    setIntroVideo(null);
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const hasMedia = identityImage || avatar || introVideo;
    const hasNumber = identityNumber.trim().length > 0;
    if (!hasMedia && !hasNumber) {
      toast.error('Chọn ít nhất một file hoặc nhập số định danh (CCCD).');
      return;
    }

    const fd = new FormData();
    if (hasNumber) fd.append('identityNumber', identityNumber.trim());
    if (identityImage) fd.append('identityImage', identityImage);
    if (avatar) fd.append('avatar', avatar);
    if (introVideo) fd.append('introVideo', introVideo);

    setSubmitting(true);
    try {
      const { data } = await api.put('/companions/me/identity', fd);
      toast.success(data.message || 'Đã cập nhật.');
      resetFiles();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload thất bại.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-slate-200">
      <h2 className="mb-1 text-lg font-semibold text-white">eKYC &amp; media (Cloudinary)</h2>
      <p className="mb-4 text-sm text-slate-400">
        Ảnh CCCD, ảnh đại diện, video giới thiệu — xem trước trước khi gửi. File không lưu trên ổ đĩa server.
      </p>

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Số CCCD / định danh</label>
          <input
            type="text"
            maxLength={30}
            value={identityNumber}
            onChange={(e) => setIdentityNumber(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
            placeholder="Tuỳ chọn — có thể gửi kèm ảnh CCCD"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-medium text-slate-300">Ảnh CCCD</p>
            <input
              ref={idInput}
              type="file"
              accept={IMAGE_ACCEPT}
              className="block w-full text-sm text-slate-400 file:mr-2 file:rounded file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-white"
              onChange={onPick(setIdentityImage, 'image')}
            />
            {previewId && (
              <img
                src={previewId}
                alt="Xem trước CCCD"
                className="mt-2 max-h-40 rounded-lg border border-slate-600 object-contain"
              />
            )}
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-slate-300">Ảnh đại diện</p>
            <input
              ref={avInput}
              type="file"
              accept={IMAGE_ACCEPT}
              className="block w-full text-sm text-slate-400 file:mr-2 file:rounded file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-white"
              onChange={onPick(setAvatar, 'image')}
            />
            {previewAv && (
              <img
                src={previewAv}
                alt="Xem trước đại diện"
                className="mt-2 max-h-40 rounded-lg border border-slate-600 object-contain"
              />
            )}
          </div>
        </div>

        <div>
          <p className="mb-1 text-sm font-medium text-slate-300">Video giới thiệu</p>
          <input
            ref={vidInput}
            type="file"
            accept={VIDEO_ACCEPT}
            className="block w-full text-sm text-slate-400 file:mr-2 file:rounded file:border-0 file:bg-violet-600 file:px-3 file:py-1.5 file:text-white"
            onChange={onPick(setIntroVideo, 'video')}
          />
          {previewVid && (
            <video
              src={previewVid}
              controls
              className="mt-2 max-h-56 w-full rounded-lg border border-slate-600"
            />
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {submitting ? 'Đang tải lên…' : 'Gửi lên Cloudinary'}
          </button>
          <button
            type="button"
            onClick={resetFiles}
            className="rounded-lg border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-800"
          >
            Xoá file đã chọn
          </button>
        </div>
      </form>
    </section>
  );
}
