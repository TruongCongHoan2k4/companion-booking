import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { api, TOKEN_KEY } from '../api/client.js';
import { notifyAuthChange } from '../lib/authEvents.js';

export default function MePanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: res } = await api.get('/auth/me');
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled && e.response?.status !== 401) {
          const msg = e.response?.data?.message || 'Không tải được /me.';
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = async () => {
    try {
      await api.post('/auth/logout');
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('role');
      localStorage.removeItem('userId');
      notifyAuthChange();
      toast.success('Đã đăng xuất.');
      setData(null);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Đăng xuất lỗi.');
    }
  };

  if (loading) {
    return (
      <p className="text-center text-slate-400">{localStorage.getItem(TOKEN_KEY) ? 'Đang tải thông tin…' : 'Đăng nhập để xem tài khoản.'}</p>
    );
  }

  if (!data?.user) {
    return <p className="text-center text-slate-400">Chưa có phiên đăng nhập hợp lệ.</p>;
  }

  return (
    <div className="mx-auto mt-8 w-full max-w-lg rounded-2xl border border-white/10 bg-slate-900/50 p-6 text-left text-slate-200">
      <h2 className="mb-4 text-lg font-semibold text-white">Thông tin tài khoản (GET /api/auth/me)</h2>
      <pre className="max-h-64 overflow-auto rounded-lg bg-black/40 p-3 text-xs">
        {JSON.stringify(data, null, 2)}
      </pre>
      <button
        type="button"
        onClick={logout}
        className="mt-4 rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
      >
        Đăng xuất (xoá cookie)
      </button>
    </div>
  );
}
