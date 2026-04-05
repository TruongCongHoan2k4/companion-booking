import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { api } from '../api/client.js';

function formatVnd(s) {
  const n = Number(s);
  if (Number.isNaN(n)) return s;
  return new Intl.NumberFormat('vi-VN').format(n) + ' đ';
}

const TX_LABEL = {
  DEPOSIT: 'Nạp tiền',
  HOLD: 'Giữ cọc',
  REFUND: 'Hoàn tiền',
  CHARGE: 'Thanh toán',
};

export default function WalletBookingPage() {
  const [me, setMe] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [depositAmt, setDepositAmt] = useState('100000');
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [pendingCompanion, setPendingCompanion] = useState([]);

  const [bookForm, setBookForm] = useState({
    companionId: '',
    bookingTime: '',
    duration: 60,
    servicePricePerHour: '',
    serviceName: '',
    location: '',
    note: '',
  });

  const loadMe = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setMe(data);
    } catch {
      setMe(null);
    }
  }, []);

  const loadWallet = useCallback(async () => {
    try {
      const { data } = await api.get('/wallet/me');
      setWallet(data);
    } catch (e) {
      setWallet(null);
      if (e.response?.status === 401) {
        toast.error('Vui lòng đăng nhập để xem ví.');
      }
    }
  }, []);

  const loadBookings = useCallback(async () => {
    try {
      const { data } = await api.get('/bookings/me');
      setBookings(data.items || []);
    } catch {
      setBookings([]);
    }
  }, []);

  const loadPendingCompanion = useCallback(async () => {
    try {
      const { data } = await api.get('/bookings/me', { params: { status: 'PENDING' } });
      setPendingCompanion(data.items || []);
    } catch {
      setPendingCompanion([]);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    await loadMe();
    await loadWallet();
    await loadBookings();
    await loadPendingCompanion();
    setLoading(false);
  }, [loadMe, loadWallet, loadBookings, loadPendingCompanion]);

  useEffect(() => {
    refreshAll();
  }, [refreshAll]);

  const onDeposit = async (e) => {
    e.preventDefault();
    const amount = parseInt(depositAmt, 10);
    if (!amount || amount < 1) {
      toast.error('Nhập số tiền nạp hợp lệ (VNĐ).');
      return;
    }
    try {
      const { data } = await api.post('/wallet/deposit', { amount });
      toast.success(data.message || 'Đã nạp tiền.');
      setDepositAmt('100000');
      await loadWallet();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Nạp tiền thất bại.');
    }
  };

  const onBook = async (e) => {
    e.preventDefault();
    if (!bookForm.companionId.trim() || bookForm.companionId.length !== 24) {
      toast.error('Nhập companionId (24 ký tự hex).');
      return;
    }
    if (!bookForm.bookingTime) {
      toast.error('Chọn thời gian đặt lịch.');
      return;
    }
    const body = {
      companionId: bookForm.companionId.trim(),
      bookingTime: new Date(bookForm.bookingTime).toISOString(),
      duration: Number(bookForm.duration),
      serviceName: bookForm.serviceName || undefined,
      location: bookForm.location || undefined,
      note: bookForm.note || undefined,
    };
    const p = bookForm.servicePricePerHour.trim();
    if (p) body.servicePricePerHour = Number(p);
    try {
      const { data } = await api.post('/bookings', body);
      toast.success(data.message || 'Đã tạo đơn.');
      setBookForm((f) => ({
        ...f,
        companionId: '',
        bookingTime: '',
        note: '',
      }));
      await loadWallet();
      await loadBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Đặt lịch thất bại.');
    }
  };

  const workflow = async (id, action) => {
    try {
      const { data } = await api.patch(`/bookings/${id}/workflow`, { action });
      toast.success(data.message || 'Đã cập nhật.');
      await loadPendingCompanion();
      await loadBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Thao tác thất bại.');
    }
  };

  const role = me?.user?.role;

  return (
    <div
      className="mx-auto max-w-3xl space-y-10 pb-16 text-slate-200"
      data-testid="page-wallet-bookings"
    >
      <div className="text-center">
        <h1 className="text-xl font-bold text-white">Ví &amp; đặt lịch</h1>
        <p className="mt-1 text-sm text-slate-400">
          API: <code className="text-violet-300">GET /api/wallet/me</code>,{' '}
          <code className="text-violet-300">POST /api/bookings</code> (transaction), v.v.
        </p>
        <Link to="/login" className="mt-2 inline-block text-sm text-violet-400 underline">
          Đăng nhập
        </Link>
      </div>

      {loading ? (
        <p className="text-center text-slate-500">Đang tải…</p>
      ) : (
        <>
          <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Ví của tôi</h2>
            {wallet ? (
              <>
                <p className="text-2xl font-bold text-emerald-400">
                  {formatVnd(wallet.walletBalance)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Số dư lưu tại trường <code className="text-slate-400">balance</code>, API trả về{' '}
                  <code className="text-slate-400">walletBalance</code>.
                </p>
                <form onSubmit={onDeposit} className="mt-4 flex flex-wrap items-end gap-2">
                  <div>
                    <label className="mb-1 block text-xs text-slate-400">Nạp tiền (mock, VNĐ)</label>
                    <input
                      type="number"
                      min={1}
                      step={1000}
                      value={depositAmt}
                      onChange={(e) => setDepositAmt(e.target.value)}
                      className="w-44 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
                  >
                    POST /wallet/deposit
                  </button>
                </form>
                <div className="mt-6 max-h-56 overflow-auto rounded-lg border border-slate-700/80">
                  <table className="w-full text-left text-xs">
                    <thead className="sticky top-0 bg-slate-800 text-slate-400">
                      <tr>
                        <th className="p-2">Loại</th>
                        <th className="p-2">Số tiền</th>
                        <th className="p-2">Mô tả</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(wallet.transactions || []).map((t) => (
                        <tr key={t._id} className="border-t border-slate-700/60">
                          <td className="p-2">{TX_LABEL[t.type] || t.type}</td>
                          <td className="p-2 font-mono text-violet-200">{formatVnd(t.amount)}</td>
                          <td className="p-2 text-slate-500">{t.description || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="text-slate-500">Chưa tải được ví (cần đăng nhập).</p>
            )}
          </section>

          {role === 'CUSTOMER' && (
            <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">Đặt lịch (khách hàng)</h2>
              <form onSubmit={onBook} className="grid gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-slate-400">Companion ID (MongoDB)</label>
                  <input
                    value={bookForm.companionId}
                    onChange={(e) => setBookForm((f) => ({ ...f, companionId: e.target.value }))}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 font-mono text-sm text-white"
                    placeholder="24 ký tự hex"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Thời gian</label>
                  <input
                    type="datetime-local"
                    value={bookForm.bookingTime}
                    onChange={(e) => setBookForm((f) => ({ ...f, bookingTime: e.target.value }))}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Thời lượng (phút)</label>
                  <input
                    type="number"
                    min={15}
                    max={1440}
                    value={bookForm.duration}
                    onChange={(e) => setBookForm((f) => ({ ...f, duration: e.target.value }))}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Giá/giờ tuỳ chọn (VNĐ)</label>
                  <input
                    value={bookForm.servicePricePerHour}
                    onChange={(e) => setBookForm((f) => ({ ...f, servicePricePerHour: e.target.value }))}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
                    placeholder="Để trống = giá companion"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-slate-400">Tên dịch vụ</label>
                  <input
                    value={bookForm.serviceName}
                    onChange={(e) => setBookForm((f) => ({ ...f, serviceName: e.target.value }))}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-slate-400">Địa điểm</label>
                  <input
                    value={bookForm.location}
                    onChange={(e) => setBookForm((f) => ({ ...f, location: e.target.value }))}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs text-slate-400">Ghi chú</label>
                  <textarea
                    value={bookForm.note}
                    onChange={(e) => setBookForm((f) => ({ ...f, note: e.target.value }))}
                    rows={2}
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-violet-600 px-4 py-2 font-medium text-white hover:bg-violet-500"
                  >
                    POST /bookings (trừ cọc trong transaction)
                  </button>
                </div>
              </form>
            </section>
          )}

          {role === 'COMPANION' && (
            <section className="rounded-2xl border border-amber-900/40 bg-slate-900/60 p-6">
              <h2 className="mb-4 text-lg font-semibold text-amber-200">Đơn chờ xác nhận (companion)</h2>
              {pendingCompanion.length === 0 ? (
                <p className="text-slate-500">Không có đơn PENDING.</p>
              ) : (
                <ul className="space-y-3">
                  {pendingCompanion.map((b) => (
                    <li
                      key={b._id}
                      className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-950/40 p-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="text-sm">
                        <p className="font-mono text-xs text-slate-500">{b._id}</p>
                        <p>
                          Cọc: <span className="text-violet-300">{formatVnd(b.holdAmount)}</span> —{' '}
                          {b.duration} phút
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          to={`/chat?booking=${encodeURIComponent(b._id)}`}
                          className="rounded border border-slate-600 px-3 py-1 text-sm text-violet-300 hover:bg-slate-800"
                        >
                          Chat
                        </Link>
                        <button
                          type="button"
                          onClick={() => workflow(b._id, 'ACCEPT')}
                          className="rounded bg-emerald-700 px-3 py-1 text-sm text-white hover:bg-emerald-600"
                        >
                          Chấp nhận
                        </button>
                        <button
                          type="button"
                          onClick={() => workflow(b._id, 'REJECT')}
                          className="rounded bg-rose-900/70 px-3 py-1 text-sm text-rose-200 hover:bg-rose-800/70"
                        >
                          Từ chối (hoàn cọc)
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">Đơn của tôi</h2>
            {bookings.length === 0 ? (
              <p className="text-slate-500">Chưa có đơn.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {bookings.map((b) => (
                  <li
                    key={b._id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-700/80 px-3 py-2 font-mono text-xs text-slate-300"
                  >
                    <span>
                      <span className="text-violet-400">{b.status}</span> — cọc {formatVnd(b.holdAmount)} —{' '}
                      {new Date(b.bookingTime).toLocaleString('vi-VN')}
                    </span>
                    <Link
                      to={`/chat?booking=${encodeURIComponent(b._id)}`}
                      className="shrink-0 text-violet-400 underline hover:text-violet-300"
                    >
                      Mở chat
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
