import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  Wallet,
  ShoppingBag,
  ArrowLeftCircle,
  Loader2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import { api } from '../api/client.js';

function formatVnd(n) {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('vi-VN').format(Number(n)) + ' đ';
}

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setForbidden(false);
      try {
        const { data: res } = await api.get('/admin/dashboard-stats');
        if (!cancelled) setData(res);
      } catch (e) {
        if (e.response?.status === 403) {
          if (!cancelled) setForbidden(true);
        } else if (!cancelled) {
          toast.error(e.response?.data?.message || 'Không tải được thống kê.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const chartData =
    data?.byMonth?.map((row) => ({
      ...row,
      revenueLabel: row.revenueVnd,
    })) || [];

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-6xl gap-6 text-slate-200">
      <aside className="hidden w-52 shrink-0 flex-col gap-2 rounded-2xl border border-white/10 bg-slate-900/60 p-4 md:flex">
        <div className="mb-4 flex items-center gap-2 text-white">
          <LayoutDashboard className="h-6 w-6 text-violet-400" />
          <span className="font-bold">Admin</span>
        </div>
        <div className="flex items-center gap-2 rounded-lg bg-violet-600/20 px-3 py-2 text-sm text-violet-200">
          <BarChart3 className="h-4 w-4 shrink-0" />
          Thống kê
        </div>
        <Link
          to="/login"
          className="mt-auto flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <ArrowLeftCircle className="h-4 w-4" />
          Về đăng nhập
        </Link>
      </aside>

      <main className="min-w-0 flex-1 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 md:hidden">
          <h1 className="flex items-center gap-2 text-xl font-bold text-white">
            <LayoutDashboard className="h-7 w-7 text-violet-400" />
            Dashboard
          </h1>
          <Link to="/login" className="text-sm text-violet-400 underline">
            Đăng nhập
          </Link>
        </div>

        <div className="hidden items-center gap-2 md:flex">
          <LayoutDashboard className="h-8 w-8 text-violet-400" />
          <h1 className="text-2xl font-bold text-white">Bảng điều khiển</h1>
        </div>

        {forbidden && (
          <div className="rounded-2xl border border-amber-800/50 bg-amber-950/30 p-6 text-amber-200">
            <p className="font-medium">Chỉ tài khoản ADMIN mới xem được thống kê.</p>
            <p className="mt-2 text-sm text-amber-200/80">
              Đăng nhập bằng user có role <code className="text-amber-100">ADMIN</code> trong database.
            </p>
            <Link to="/login" className="mt-4 inline-block text-violet-400 underline">
              Đăng nhập
            </Link>
          </div>
        )}

        {loading && !forbidden && (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            Đang tải aggregation…
          </div>
        )}

        {!loading && data && !forbidden && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <div className="flex items-center gap-2 text-slate-400">
                  <ShoppingBag className="h-5 w-5 text-sky-400" />
                  <span className="text-sm">Tổng đơn đặt</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-white">{data.summary.totalBookings}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <div className="flex items-center gap-2 text-slate-400">
                  <BarChart3 className="h-5 w-5 text-emerald-400" />
                  <span className="text-sm">Tổng thu (CHARGE)</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-emerald-300">
                  {formatVnd(data.summary.totalRevenueVnd)}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                <div className="flex items-center gap-2 text-slate-400">
                  <Wallet className="h-5 w-5 text-violet-400" />
                  <span className="text-sm">Tổng nạp ví (DEPOSIT)</span>
                </div>
                <p className="mt-2 text-2xl font-bold text-violet-200">
                  {formatVnd(data.summary.totalDepositsVnd)}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-4">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-white">
                <BarChart3 className="h-5 w-5 text-violet-400" />
                Theo tháng (12 tháng gần nhất)
              </h2>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                    <YAxis
                      yAxisId="left"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      allowDecimals={false}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      tickFormatter={(v) => (v >= 1e6 ? `${(v / 1e6).toFixed(1)}M` : `${v}`)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: '#e2e8f0' }}
                      formatter={(value, name) => {
                        if (name === 'revenueVnd' || name === 'Doanh thu (VNĐ)') {
                          return [formatVnd(value), 'Doanh thu (CHARGE)'];
                        }
                        return [value, 'Số đơn'];
                      }}
                    />
                    <Legend />
                    <Bar
                      yAxisId="left"
                      dataKey="orders"
                      name="Số đơn"
                      fill="#6366f1"
                      radius={[4, 4, 0, 0]}
                    />
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="revenueVnd"
                      name="Doanh thu (VNĐ)"
                      stroke="#34d399"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#34d399' }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
