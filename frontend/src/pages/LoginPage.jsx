import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { loginSchema } from '../schemas/authSchemas.js';
import { api, TOKEN_KEY } from '../api/client.js';
import { notifyAuthChange } from '../lib/authEvents.js';

export default function LoginPage() {
  const navigate = useNavigate();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const onSubmit = async (data) => {
    try {
      const { data: res } = await api.post('/auth/login', data);
      if (res.token) {
        localStorage.setItem(TOKEN_KEY, res.token);
        if (res.user) {
          localStorage.setItem('role', res.user.role || '');
          const uid = res.user._id ?? res.user.id;
          if (uid != null) localStorage.setItem('userId', String(uid));
        }
        notifyAuthChange();
      }
      toast.success(res.message || 'Đăng nhập thành công.');
      navigate('/wallet-bookings', { replace: true });
    } catch (e) {
      const msg = e.response?.data?.message || 'Đăng nhập thất bại.';
      toast.error(msg);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/70 p-8 shadow-xl backdrop-blur-md">
      <h1 className="mb-1 text-2xl font-bold text-white">Đăng nhập</h1>
      <p className="mb-6 text-sm text-slate-400">Nhập tài khoản để tiếp tục.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Tên đăng nhập</label>
          <input
            type="text"
            autoComplete="username"
            data-testid="login-username"
            className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
            {...register('username')}
          />
          {errors.username && (
            <p className="mt-1 text-sm text-rose-400">{errors.username.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Mật khẩu</label>
          <input
            type="password"
            autoComplete="current-password"
            data-testid="login-password"
            className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
            {...register('password')}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-rose-400">{errors.password.message}</p>
          )}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          data-testid="login-submit"
          className="w-full rounded-lg bg-violet-600 py-2.5 font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
        >
          {isSubmitting ? 'Đang xử lý…' : 'Đăng nhập'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        <Link to="/forgot-password" className="font-medium text-violet-400 hover:text-violet-300">
          Quên mật khẩu?
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-slate-400">
        Chưa có tài khoản?{' '}
        <Link to="/register" className="font-medium text-violet-400 hover:text-violet-300">
          Đăng ký
        </Link>
      </p>
    </div>
  );
}
