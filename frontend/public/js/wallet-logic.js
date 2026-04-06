/**
 * Ví & đặt lịch: nạp tiền (POST /wallet/deposit), tạo booking (POST /bookings).
 * Cần JWT trong localStorage (key 'token'), giống user.js / SPA.
 */
(function () {
  const API_BASE = typeof window !== 'undefined' && window.__API_BASE__ ? window.__API_BASE__ : '/api';

  const TOKEN_KEY = 'token';

  function authHeaderMaybe() {
    const t = localStorage.getItem(TOKEN_KEY);
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  async function parseJsonSafe(res) {
    try {
      return await res.json();
    } catch {
      return {};
    }
  }

  /**
   * Nạp tiền mock (VNĐ). Backend chỉ bắt buộc { amount }; các field khác sẽ bị strip nếu có.
   * @param {number} amount — số nguyên dương
   * @returns {Promise<object>}
   */
  async function deposit(amount) {
    const n = typeof amount === 'string' ? parseInt(amount, 10) : Number(amount);
    if (!n || n < 1 || !Number.isFinite(n)) {
      const err = new Error('Nhập số tiền nạp hợp lệ (VNĐ).');
      err.code = 'VALIDATION';
      throw err;
    }
    const res = await fetch(`${API_BASE}/wallet/deposit`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaderMaybe(),
      },
      body: JSON.stringify({ amount: Math.floor(n) }),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      const err = new Error(data.message || 'Nạp tiền thất bại.');
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  /**
   * Tạo đơn đặt lịch (khách). companionId = MongoDB ObjectId 24 hex.
   * @param {object} raw — companionId, bookingTime (Date | string ISO | datetime-local), duration (phút), ...
   */
  async function createBooking(raw) {
    const companionId = String(raw.companionId || '').trim();
    if (companionId.length !== 24) {
      const err = new Error('Nhập companionId (24 ký tự hex).');
      err.code = 'VALIDATION';
      throw err;
    }
    if (!raw.bookingTime) {
      const err = new Error('Chọn thời gian đặt lịch.');
      err.code = 'VALIDATION';
      throw err;
    }
    const bookingTime =
      raw.bookingTime instanceof Date
        ? raw.bookingTime.toISOString()
        : new Date(raw.bookingTime).toISOString();
    const body = {
      companionId,
      bookingTime,
      duration: Number(raw.duration),
      serviceName: raw.serviceName || undefined,
      location: raw.location || undefined,
      note: raw.note || undefined,
    };
    const p = raw.servicePricePerHour != null ? String(raw.servicePricePerHour).trim() : '';
    if (p) body.servicePricePerHour = Number(p);

    const res = await fetch(`${API_BASE}/bookings`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaderMaybe(),
      },
      body: JSON.stringify(body),
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      const err = new Error(data.message || 'Đặt lịch thất bại.');
      err.status = res.status;
      err.body = data;
      throw err;
    }
    return data;
  }

  /** GET /wallet/me — cần đăng nhập */
  async function getWalletMe() {
    const res = await fetch(`${API_BASE}/wallet/me`, {
      credentials: 'include',
      headers: { ...authHeaderMaybe() },
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      const err = new Error(data.message || 'Không tải được ví.');
      err.status = res.status;
      throw err;
    }
    return data;
  }

  /** GET /bookings/me */
  async function getBookingsMe(params) {
    const q = params && typeof params === 'object' ? new URLSearchParams(params).toString() : '';
    const url = q ? `${API_BASE}/bookings/me?${q}` : `${API_BASE}/bookings/me`;
    const res = await fetch(url, {
      credentials: 'include',
      headers: { ...authHeaderMaybe() },
    });
    const data = await parseJsonSafe(res);
    if (!res.ok) {
      const err = new Error(data.message || 'Không tải được đơn.');
      err.status = res.status;
      throw err;
    }
    return Array.isArray(data) ? data : data.items ?? [];
  }

  window.WalletLogic = {
    API_BASE,
    TOKEN_KEY,
    deposit,
    createBooking,
    getWalletMe,
    getBookingsMe,
  };
})();
