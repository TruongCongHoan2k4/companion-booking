import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { NumericFormat } from 'react-number-format';
import toast from 'react-hot-toast';
import { api } from '../api/client.js';

function formatVndDisplay(num) {
  if (num == null || Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('vi-VN').format(num) + ' đ';
}

export default function CompanionServicePrices() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);

  const {
    control,
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      serviceName: '',
      pricePerHour: undefined,
      description: '',
    },
  });

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/companions/me/service-prices');
      setItems(data.items || []);
    } catch (e) {
      toast.error(e.response?.data?.message || 'Không tải được bảng giá.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onSubmit = async (values) => {
    const price = values.pricePerHour;
    if (price == null || price <= 0) {
      toast.error('Nhập giá theo giờ (VNĐ) hợp lệ.');
      return;
    }
    const body = {
      serviceName: values.serviceName.trim(),
      pricePerHour: price,
      description: values.description?.trim() || undefined,
    };
    try {
      if (editingId) {
        const { data } = await api.put(`/companions/me/service-prices/${editingId}`, body);
        toast.success(data.message || 'Đã cập nhật.');
      } else {
        const { data } = await api.post('/companions/me/service-prices', body);
        toast.success(data.message || 'Đã thêm.');
      }
      setEditingId(null);
      reset({ serviceName: '', pricePerHour: undefined, description: '' });
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Lưu thất bại.');
    }
  };

  const startEdit = (row) => {
    setEditingId(row._id);
    reset({
      serviceName: row.serviceName,
      pricePerHour: Number(row.pricePerHour),
      description: row.description || '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditingId(null);
    reset({ serviceName: '', pricePerHour: undefined, description: '' });
  };

  const remove = async (id) => {
    if (!window.confirm('Xóa dịch vụ này?')) return;
    try {
      const { data } = await api.delete(`/companions/me/service-prices/${id}`);
      toast.success(data.message || 'Đã xóa.');
      if (editingId === id) cancelEdit();
      await load();
    } catch (e) {
      toast.error(e.response?.data?.message || 'Xóa thất bại.');
    }
  };

  return (
    <section className="mx-auto mt-8 w-full max-w-2xl rounded-2xl border border-white/10 bg-slate-900/60 p-6 text-slate-200">
      <h2 className="mb-1 text-lg font-semibold text-white">Bảng giá dịch vụ</h2>
      <p className="mb-4 text-sm text-slate-400">React Hook Form + định dạng tiền VNĐ khi nhập.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mb-8 space-y-4 rounded-xl border border-slate-700/80 bg-slate-950/40 p-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Tên dịch vụ</label>
          <input
            className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
            {...register('serviceName', { required: 'Bắt buộc' })}
          />
          {errors.serviceName && (
            <p className="mt-1 text-sm text-rose-400">{errors.serviceName.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Giá / giờ (VNĐ)</label>
          <Controller
            name="pricePerHour"
            control={control}
            rules={{
              validate: (v) =>
                v != null && v > 0 ? true : 'Nhập số tiền dương',
            }}
            render={({ field: { onChange, onBlur, value, name, ref } }) => (
              <NumericFormat
                name={name}
                getInputRef={ref}
                value={value ?? ''}
                onBlur={onBlur}
                thousandSeparator="."
                decimalSeparator=","
                decimalScale={0}
                allowNegative={false}
                placeholder="Ví dụ: 200.000"
                className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
                onValueChange={(vals) => {
                  onChange(vals.floatValue);
                }}
              />
            )}
          />
          {errors.pricePerHour && (
            <p className="mt-1 text-sm text-rose-400">{errors.pricePerHour.message}</p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">Mô tả (tuỳ chọn)</label>
          <textarea
            rows={2}
            className="w-full rounded-lg border border-slate-600 bg-slate-800/80 px-3 py-2 text-white outline-none ring-violet-500 focus:ring-2"
            {...register('description')}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {editingId ? 'Cập nhật' : 'Thêm dịch vụ'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-slate-600 px-4 py-2 text-slate-300 hover:bg-slate-800"
            >
              Huỷ sửa
            </button>
          )}
        </div>
      </form>

      {loading ? (
        <p className="text-slate-500">Đang tải…</p>
      ) : items.length === 0 ? (
        <p className="text-slate-500">Chưa có dịch vụ nào.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((row) => (
            <li
              key={row._id}
              className="flex flex-col gap-2 rounded-lg border border-slate-700 bg-slate-950/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium text-white">{row.serviceName}</p>
                <p className="text-sm text-violet-300">{formatVndDisplay(Number(row.pricePerHour))}</p>
                {row.description && (
                  <p className="mt-1 text-xs text-slate-500">{row.description}</p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => startEdit(row)}
                  className="rounded border border-slate-600 px-3 py-1 text-sm text-slate-300 hover:bg-slate-800"
                >
                  Sửa
                </button>
                <button
                  type="button"
                  onClick={() => remove(row._id)}
                  className="rounded border border-rose-900/60 px-3 py-1 text-sm text-rose-400 hover:bg-rose-950/40"
                >
                  Xóa
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
