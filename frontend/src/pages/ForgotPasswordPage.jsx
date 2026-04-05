import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../api/client.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Nhập email.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/forgot-password', { email: email.trim() });
      toast.success(data.message || 'Đã gửi yêu cầu.');
      navigate('/reset-password', { state: { email: email.trim().toLowerCase() } });
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thất bại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/70 p-8 shadow-xl backdrop-blur-md">
      <h1 className="mb-1 text-2xl font-bold text-white">Quên mật khẩu</h1>
      <p className="mb-6 text-sm text-slate-400">
        Nhập email đã đăng ký. Hệ thống gửi mã OTP (Nodemailer / log console nếu chưa cấu hình SMTP).
      </p>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-violet-600 py-2.5 font-semibold text-white hover:bg-violet-500 disabled:opacity-60"
        >
          {loading ? 'Đang gửi…' : 'Gửi mã OTP'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-400">
        <Link to="/login" className="text-violet-400 hover:text-violet-300">
          Quay lại đăng nhập
        </Link>
      </p>
    </div>
  );
}
