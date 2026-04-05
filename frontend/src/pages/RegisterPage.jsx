import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { registerSchema } from '../schemas/authSchemas.js';
import { api } from '../api/client.js';

export default function RegisterPage() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      username: '',
      password: '',
      email: '',
      fullName: '',
      phoneNumber: '',
      role: 'CUSTOMER',
    },
  });

  const onSubmit = async (values) => {
    const body = {
      ...values,
      fullName: values.fullName || undefined,
      phoneNumber: values.phoneNumber || undefined,
    };
    try {
      const { data: res } = await api.post('/auth/register', body);
      toast.success(res.message || 'Đăng ký thành công.');
    } catch (e) {
      const msg = e.response?.data?.message || 'Đăng ký thất bại.';
      toast.error(msg);
    }
  };

  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/70 p-8 shadow-xl backdrop-blur-md">
      <h1 className="mb-1 text-2xl font-bold text-white">Đăng ký</h1>
      <p className="mb-6 text-sm text-slate-400">Tạo tài khoản khách hàng hoặc companion.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Tên đăng nhập</label>
          <input
            type="text"
            autoComplete="username"
            className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
            {...register('username')}
          />
          {errors.username && (
            <p className="mt-1 text-sm text-rose-400">{errors.username.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Email</label>
          <input
            type="email"
            autoComplete="email"
            className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
            {...register('email')}
          />
          {errors.email && <p className="mt-1 text-sm text-rose-400">{errors.email.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Mật khẩu</label>
          <input
            type="password"
            autoComplete="new-password"
            className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
            {...register('password')}
          />
          {errors.password && (
            <p className="mt-1 text-sm text-rose-400">{errors.password.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Họ tên (tuỳ chọn)</label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
            {...register('fullName')}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">SĐT (tuỳ chọn)</label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
            {...register('phoneNumber')}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Vai trò</label>
          <select
            className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
            {...register('role')}
          >
            <option value="CUSTOMER">Khách hàng</option>
            <option value="COMPANION">Companion</option>
          </select>
          {errors.role && <p className="mt-1 text-sm text-rose-400">{errors.role.message}</p>}
        </div>
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-violet-600 py-2.5 font-semibold text-white transition hover:bg-violet-500 disabled:opacity-60"
        >
          {isSubmitting ? 'Đang xử lý…' : 'Đăng ký'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-slate-400">
        Đã có tài khoản?{' '}
        <Link to="/login" className="font-medium text-violet-400 hover:text-violet-300">
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
