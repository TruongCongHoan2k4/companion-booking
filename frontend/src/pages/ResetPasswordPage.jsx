import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import OtpInput from 'react-otp-input';
import toast from 'react-hot-toast';
import { api } from '../api/client.js';

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const initialEmail = location.state?.email || '';

  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (password !== password2) {
      toast.error('Mật khẩu xác nhận không khớp.');
      return;
    }
    if (otp.length !== 6) {
      toast.error('Nhập đủ 6 số OTP.');
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/reset-password', {
        email: email.trim().toLowerCase(),
        otp,
        newPassword: password,
      });
      toast.success(data.message || 'Thành công.');
      navigate('/login');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Đặt lại mật khẩu thất bại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/70 p-8 shadow-xl backdrop-blur-md">
      <h1 className="mb-1 text-2xl font-bold text-white">Nhập OTP &amp; mật khẩu mới</h1>
      <p className="mb-6 text-sm text-slate-400">
        Mã OTP (HOTP, <code className="text-violet-400">otplib</code>) gồm 6 chữ số.
      </p>
      <form onSubmit={onSubmit} className="space-y-5">
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
        <div>
          <p className="mb-2 text-sm font-medium text-slate-300">Mã OTP</p>
          <OtpInput
            value={otp}
            onChange={setOtp}
            numInputs={6}
            shouldAutoFocus
            renderInput={(props) => (
              <input
                {...props}
                className="mx-0.5 h-11 w-10 rounded-lg border border-slate-600 bg-slate-800 text-center text-lg font-semibold text-white outline-none ring-violet-500 focus:ring-2 sm:h-12 sm:w-11"
              />
            )}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Mật khẩu mới</label>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Xác nhận mật khẩu</label>
          <input
            type="password"
            required
            minLength={8}
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-emerald-600 py-2.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {loading ? 'Đang xử lý…' : 'Đặt lại mật khẩu'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-400">
        <Link to="/forgot-password" className="text-violet-400 hover:text-violet-300">
          Gửi lại OTP
        </Link>
        {' · '}
        <Link to="/login" className="text-violet-400 hover:text-violet-300">
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
