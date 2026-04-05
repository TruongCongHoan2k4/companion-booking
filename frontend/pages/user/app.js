function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN');
}

function toLocalInputDateTime(value) {
  const date = value ? new Date(value) : new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const AUTH_TOKEN_KEY = 'token';

function authHeaderMaybe() {
  const t = localStorage.getItem(AUTH_TOKEN_KEY);
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function apiFetch(url, options = {}) {
  const { headers: hdr, ...rest } = options;
  const response = await fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaderMaybe(),
      ...(hdr || {}),
    },
    ...rest,
  });
  return response;
}

async function getAuth() {
  const response = await apiFetch('/api/auth/me');
  if (!response.ok) return { authenticated: false };
  return response.json();
}

function setMessage(targetId, type, text) {
  const box = document.getElementById(targetId);
  if (!box) return;
  if (!text) {
    box.innerHTML = '';
    return;
  }
  box.innerHTML = `<div class="alert alert-${type} mb-0">${escapeHtml(text)}</div>`;
}

function renderTopNav(auth) {
  const nav = document.getElementById('top-nav');
  if (!nav) return;

  const authPart = auth.authenticated
    ? `
            <span class="navbar-text me-3">Xin chào, <strong>${escapeHtml(auth.username)}</strong></span>
            <button id="logout-btn" class="btn btn-outline-danger btn-sm">Đăng xuất</button>
        `
    : `
            <a class="btn btn-outline-primary btn-sm me-2" href="../user/login.html">Đăng nhập</a>
            <a class="btn btn-primary btn-sm" href="../user/register.html">Đăng ký</a>
        `;

  nav.innerHTML = `
        <a class="btn btn-link text-decoration-none" href="../user/index.html">Trang chủ</a>
        <a class="btn btn-link text-decoration-none" href="../user/search.html">Tìm kiếm</a>
        <a class="btn btn-link text-decoration-none" href="../user/appointments.html">Lịch hẹn</a>
        <a class="btn btn-link text-decoration-none" href="../user/favorites.html">Yêu thích</a>
        <a class="btn btn-link text-decoration-none" href="../user/review.html">Đánh giá</a>
        <a class="btn btn-link text-decoration-none" href="../user/report.html">Tố cáo</a>
        ${authPart}
    `;

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      } finally {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem('role');
        localStorage.removeItem('userId');
        window.location.href = '../user/index.html';
      }
    });
  }
}

function companionCard(companion, showActions) {
  const name = companion.user?.fullName || companion.user?.username || 'Unknown';
  const bio = companion.bio || 'Chưa có mô tả';
  const availability = companion.availability || 'Chưa cập nhật';
  const actions = showActions
    ? `
            <div class="d-grid gap-2">
                <a class="btn btn-outline-primary btn-sm" href="../user/profile.html?id=${companion.id}">Xem chi tiết</a>
                <a class="btn btn-primary btn-sm" href="/user/booking.html?id=${companion.id}">Đặt lịch</a>
            </div>
        `
    : '';
  return `
        <div class="col">
            <div class="card h-100 shadow-sm">
                <div class="card-body">
                    <h5 class="card-title">${escapeHtml(name)}</h5>
                    <p class="card-text mb-2"><strong>Bio:</strong> ${escapeHtml(bio)}</p>
                    <p class="card-text text-muted"><strong>Ranh:</strong> ${escapeHtml(availability)}</p>
                    ${actions}
                </div>
            </div>
        </div>
    `;
}

async function initCompanionGrid(targetId) {
  const container = document.getElementById(targetId);
  if (!container) return;
  try {
    const response = await apiFetch('/api/companions');
    const companions = await response.json();
    if (!companions.length) {
      container.innerHTML = '<div class="alert alert-info">Chưa có companion.</div>';
      return;
    }
    container.innerHTML = companions.map((c) => companionCard(c, true)).join('');
  } catch (error) {
    container.innerHTML = '<div class="alert alert-danger">Không tải được danh sách companion.</div>';
  }
}

async function bootstrapLayout() {
  const auth = await getAuth().catch(() => ({ authenticated: false }));
  renderTopNav(auth);
  return auth;
}

window.userApp = {
  apiFetch,
  bootstrapLayout,
  getAuth,
  formatDateTime,
  toLocalInputDateTime,
  escapeHtml,
  initCompanionGrid,
  setMessage,
};
