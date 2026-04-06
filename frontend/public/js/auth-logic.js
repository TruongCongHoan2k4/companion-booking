/**
 * Logic đăng nhập / đăng ký (fetch thuần), đồng bộ với SPA: token + role + userId trong localStorage.
 * Gán window.__API_BASE__ trước khi load nếu cần base URL tuyệt đối (mặc định '/api').
 */
(function () {
  const API_BASE = typeof window !== 'undefined' && window.__API_BASE__ ? window.__API_BASE__ : '/api';

  const TOKEN_KEY = 'token';

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function setAuthMessage(type, text) {
    const node = document.getElementById('auth-message');
    if (!node) return;
    node.innerHTML = text
      ? `<div class="alert alert-${type} mb-0">${escapeHtml(text)}</div>`
      : '';
  }

  /**
   * @param {string} username
   * @param {string} password
   * @returns {Promise<object>} JSON phản hồi backend (có token, user, message…)
   */
  async function login(username, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    let data = {};
    try {
      data = await res.json();
    } catch {
      const err = new Error('Phản hồi từ server không hợp lệ.');
      err.status = res.status;
      throw err;
    }
    if (!res.ok) {
      const err = new Error(data.message || 'Đăng nhập thất bại.');
      err.status = res.status;
      err.body = data;
      throw err;
    }
    if (data.token) {
      localStorage.setItem(TOKEN_KEY, data.token);
      if (data.user) {
        localStorage.setItem('role', data.user.role || '');
        const uid = data.user._id ?? data.user.id;
        if (uid != null) localStorage.setItem('userId', String(uid));
      }
    }
    return data;
  }

  /**
   * @param {object} data — ví dụ: { username, password, email, fullName?, phoneNumber?, role? }
   * @returns {Promise<object>}
   */
  async function register(data) {
    const body = {
      ...data,
      fullName: data.fullName || undefined,
      phoneNumber: data.phoneNumber || undefined,
    };
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    let out = {};
    try {
      out = await res.json();
    } catch {
      const err = new Error('Phản hồi từ server không hợp lệ.');
      err.status = res.status;
      throw err;
    }
    if (!res.ok) {
      const err = new Error(out.message || 'Đăng ký thất bại.');
      err.status = res.status;
      err.body = out;
      throw err;
    }
    return out;
  }

  function redirectAfterLogin() {
    const role = localStorage.getItem('role') || '';
    if (role === 'ADMIN') {
      window.location.href = '../admin/dashboard.html';
      return;
    }
    if (role === 'COMPANION') {
      window.location.href = '../companion/dashboard.html';
      return;
    }
    window.location.href = './wallet.html';
  }

  async function onLoginSubmit(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const form = event?.target;
    if (!form) return false;
    const username = (form.username?.value || '').trim();
    const password = form.password?.value || '';
    setAuthMessage('danger', '');
    try {
      await login(username, password);
      setAuthMessage('success', 'Đăng nhập thành công.');
      redirectAfterLogin();
    } catch (e) {
      setAuthMessage('danger', e.message || 'Đăng nhập thất bại.');
    }
    return false;
  }

  async function onRegisterSubmit(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    const form = event?.target;
    if (!form) return false;
    const payload = {
      username: (form.username?.value || '').trim(),
      password: form.password?.value || '',
      email: (form.email?.value || '').trim(),
      role: (form.role?.value || 'CUSTOMER').trim() || 'CUSTOMER',
    };
    if (form.fullName && form.fullName.value) payload.fullName = form.fullName.value.trim();
    if (form.phoneNumber && form.phoneNumber.value) payload.phoneNumber = form.phoneNumber.value.trim();

    setAuthMessage('danger', '');
    try {
      await register(payload);
      window.location.href = './login.html?registered=1';
    } catch (e) {
      setAuthMessage('danger', e.message || 'Đăng ký thất bại.');
    }
    return false;
  }

  function initRegisteredBanner() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('registered') === '1') {
      setAuthMessage('success', 'Đăng ký thành công, vui lòng đăng nhập.');
    }
  }

  window.AuthLogic = {
    API_BASE,
    TOKEN_KEY,
    login,
    register,
    onLoginSubmit,
    onRegisterSubmit,
    initRegisteredBanner,
  };
})();
