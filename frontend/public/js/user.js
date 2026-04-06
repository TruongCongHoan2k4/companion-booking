/** Đồng bộ với SPA (Vite): JWT lưu localStorage, gửi Bearer + cookie (nếu có). */
const AUTH_TOKEN_KEY = 'token';

function authHeaderMaybe() {
  const t = localStorage.getItem(AUTH_TOKEN_KEY);
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function apiFetch(url, options = {}) {
  const { headers: hdr, ...rest } = options;
  return fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaderMaybe(),
      ...(hdr || {}),
    },
    ...rest,
  });
}

/** Backend trả `{ items }` hoặc mảng trực tiếp. */
async function bookingsMeList(res) {
  if (!res.ok) return [];
  const j = await res.json();
  return Array.isArray(j) ? j : j.items ?? [];
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN');
}

/** Giống backend RentalVenuesUtil: mỗi dòng là một nơi thuê. */
function parseRentalVenuesLines(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Một số phiên bản Spring có thể serialize Optional thành { present, value }. */
function unwrapOptionalEntity(data) {
  if (
    data &&
    typeof data === 'object' &&
    'value' in data &&
    data.value != null &&
    typeof data.value === 'object' &&
    'id' in data.value
  ) {
    return data.value;
  }
  return data;
}

async function reporterIsLikelyDenied() {
  try {
    if (!navigator.permissions || !navigator.permissions.query) return false;
    const st = await navigator.permissions.query({ name: 'geolocation' });
    return st.state === 'denied';
  } catch {
    return false;
  }
}

/**
 * Lấy tọa độ thiết bị (khách). Thử độ chính xác cao trước, lỗi/hết giờ thì thử mạng/Wi‑Fi.
 * Quan trọng: getCurrentPosition được gọi ngay trong executor Promise (không await trước đó),
 * để còn “user gesture” — trình duyệt mới hiện hỏi cấp quyền vị trí.
 */
function getReporterGps() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ lat: null, lng: null });
      return;
    }
    const lowAccuracy = () => {
      navigator.geolocation.getCurrentPosition(
        (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => resolve({ lat: null, lng: null }),
        { enableHighAccuracy: false, timeout: 22000, maximumAge: 300000 }
      );
    };
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => lowAccuracy(),
      { enableHighAccuracy: true, timeout: 28000, maximumAge: 0 }
    );
  });
}

/**
 * Gọi trong handler click/change (cùng lượt tương tác) để trình duyệt hỏi quyền sớm khi bật SOS.
 */
function primeReporterGeolocationFromGesture() {
  if (!navigator.geolocation || !window.isSecureContext) return;
  navigator.geolocation.getCurrentPosition(
    () => {},
    () => {},
    { enableHighAccuracy: false, timeout: 15000, maximumAge: 300000 }
  );
}

function toDateInputValue(value) {
  const date = value ? new Date(value) : new Date();
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function setMessage(targetId, type, text) {
  const node = document.getElementById(targetId);
  if (!node) return;
  node.innerHTML = text ? `<div class="alert alert-${type} mb-0">${escapeHtml(text)}</div>` : '';
}

/** Đọc thông báo lỗi từ body JSON (Spring: message) hoặc chuỗi thuần. */
async function parseApiErrorMessage(res, fallback) {
  const fb = fallback ?? 'Đặt lịch thất bại. Vui lòng kiểm tra thông tin.';
  try {
    const text = await res.text();
    if (!text || !String(text).trim()) return fb;
    try {
      const j = JSON.parse(text);
      if (typeof j.message === 'string' && j.message.trim()) return j.message;
      if (typeof j.error === 'string' && j.error.trim()) return j.error;
    } catch {
      return String(text).trim();
    }
  } catch {
    return fb;
  }
  return fb;
}

async function getAuth() {
  const res = await apiFetch('/api/auth/me');
  if (!res.ok) return { authenticated: false };
  return res.json();
}

function renderTopNav(auth) {
  const nav = document.getElementById('top-nav');
  if (!nav) return;
  const links = `
        <a class="btn btn-sm btn-link text-decoration-none app-nav-item" href="./index.html" title="Trang chủ"><i class="bi bi-house"></i><span class="app-nav-text ms-1">Trang chủ</span></a>
        <a class="btn btn-sm btn-link text-decoration-none app-nav-item" href="./search.html" title="Tìm kiếm"><i class="bi bi-search"></i><span class="app-nav-text ms-1">Tìm</span></a>
        <a class="btn btn-sm btn-link text-decoration-none app-nav-item" href="./appointments.html" title="Lịch hẹn"><i class="bi bi-calendar-event"></i><span class="app-nav-text ms-1">Lịch</span></a>
        <a class="btn btn-sm btn-link text-decoration-none app-nav-item" href="./chat.html?bookingId=" title="Chat"><i class="bi bi-chat-dots"></i><span class="app-nav-text ms-1">Chat</span></a>
        <a class="btn btn-sm btn-link text-decoration-none app-nav-item" href="./wallet.html" title="Ví tiền"><i class="bi bi-wallet2"></i><span class="app-nav-text ms-1">Ví</span></a>
        <a class="btn btn-sm btn-link text-decoration-none app-nav-item" href="./favorites.html" title="Yêu thích"><i class="bi bi-heart"></i><span class="app-nav-text ms-1">Yêu thích</span></a>
        <a class="btn btn-sm btn-link text-decoration-none app-nav-item" href="./review.html" title="Đánh giá"><i class="bi bi-star"></i><span class="app-nav-text ms-1">Đánh giá</span></a>
        <a class="btn btn-sm btn-link text-decoration-none app-nav-item" href="./report.html" title="Tố cáo"><i class="bi bi-flag"></i><span class="app-nav-text ms-1">Tố cáo</span></a>
        <a class="btn btn-sm btn-link text-decoration-none app-nav-item position-relative" href="./notifications.html" id="notification-link" title="Thông báo"><i class="bi bi-bell"></i><span class="app-nav-text ms-1">Báo</span><span id="notification-badge" class="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger d-none" style="font-size:0.6rem;">0</span></a>
    `;
  const companionDashboardBtn =
    auth.authenticated && auth.role === 'COMPANION'
      ? `<a class="btn btn-outline-primary btn-sm ms-1 py-1" href="../companion/dashboard.html" title="Dashboard Companion"><i class="bi bi-grid-1x2"></i><span class="app-nav-text ms-1 d-none d-lg-inline">Companion</span></a>`
      : '';
  const authPart = auth.authenticated
    ? `<span class="navbar-text ms-1 small text-nowrap"><i class="bi bi-person-circle"></i> <strong>${escapeHtml(auth.username)}</strong></span>
           ${companionDashboardBtn}
           <button id="logout-btn" type="button" class="btn btn-outline-danger btn-sm ms-1 py-1" title="Đăng xuất"><i class="bi bi-box-arrow-right"></i><span class="app-nav-text ms-1 d-none d-md-inline">Thoát</span></button>`
    : `<a class="btn btn-outline-primary btn-sm ms-1 py-1" href="./login.html" title="Đăng nhập"><i class="bi bi-box-arrow-in-right"></i><span class="app-nav-text ms-1 d-none d-sm-inline">Đăng nhập</span></a>
           <a class="btn btn-primary btn-sm ms-1 py-1" href="./register.html" title="Đăng ký"><i class="bi bi-person-plus"></i><span class="app-nav-text ms-1 d-none d-sm-inline">Đăng ký</span></a>`;
  nav.innerHTML = `${links}${authPart}`;
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await apiFetch('/api/auth/logout', { method: 'POST' });
      } finally {
        localStorage.removeItem(AUTH_TOKEN_KEY);
        localStorage.removeItem('role');
        localStorage.removeItem('userId');
        window.location.href = './index.html';
      }
    });
  }
}

/** Nhãn giá VND/giờ từ servicePriceMin/Max (API) hoặc fallback pricePerHour. */
function formatCompanionHourlyPriceRange(companion) {
  const min =
    companion.servicePriceMin != null ? Number(companion.servicePriceMin) : Number(companion.pricePerHour || 0);
  const max =
    companion.servicePriceMax != null ? Number(companion.servicePriceMax) : Number(companion.pricePerHour || 0);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return '— VND/h';
  if (min <= 0 && max <= 0) return '— VND/h';
  if (min === max) return `${min.toLocaleString('vi-VN')} VND/h`;
  return `${min.toLocaleString('vi-VN')} – ${max.toLocaleString('vi-VN')} VND/h`;
}

function companionCard(companion) {
  const name = companion.user?.fullName || companion.user?.username || 'Companion';
  const rating = companion.averageRating
    ? `${Number(companion.averageRating).toFixed(1)} ★ (${companion.reviewCount || 0})`
    : 'Chưa có đánh giá';
  const onlineClass = companion.onlineStatus ? 'bg-success' : 'bg-secondary';
  const onlineText = companion.onlineStatus ? 'Online' : 'Offline';
  return `
    <div class="col">
      <div class="card user-card h-100">
        <div class="card-body p-4">
          <div class="d-flex align-items-center gap-3 mb-3">
            <div class="d-inline-flex align-items-center justify-content-center rounded-circle flex-shrink-0" style="width:48px;height:48px;background:linear-gradient(135deg,#6366f1,#8b5cf6);">
              <i class="bi bi-person-fill text-white" style="font-size:1.3rem;"></i>
            </div>
            <div>
              <h5 class="card-title mb-0 fw-bold">${escapeHtml(name)}</h5>
              <div class="d-flex align-items-center gap-2 mt-1">
                <span class="badge bg-warning text-dark" style="font-size:0.75rem;">${rating}</span>
                <span class="badge ${onlineClass}" style="font-size:0.7rem;"><i class="bi bi-circle-fill me-1" style="font-size:0.4rem;"></i>${onlineText}</span>
              </div>
            </div>
          </div>
          <p class="card-text text-muted small mb-2"><i class="bi bi-chat-quote me-1"></i>${escapeHtml(companion.bio || 'Chưa có mô tả')}</p>
          <p class="card-text text-muted small mb-2"><i class="bi bi-heart me-1"></i>${escapeHtml(companion.hobbies || 'Chưa có sở thích')}</p>
          <div class="d-flex flex-wrap gap-2 mb-3">
            <span class="badge bg-light text-dark border"><i class="bi bi-grid me-1"></i>${escapeHtml(companion.serviceType || '-')}</span>
            <span class="badge bg-light text-dark border"><i class="bi bi-geo-alt me-1"></i>${escapeHtml(companion.area || '-')}</span>
            <span class="badge bg-light text-dark border"><i class="bi bi-cash me-1"></i>${formatCompanionHourlyPriceRange(companion)}</span>
          </div>
          <div class="d-grid gap-2">
            <a class="btn btn-outline-primary btn-sm" href="./profile.html?id=${companion.id}"><i class="bi bi-person-lines-fill me-1"></i>Xem profile</a>
            <a class="btn btn-primary btn-sm" href="./booking.html?id=${companion.id}"><i class="bi bi-calendar-plus me-1"></i>Đặt lịch</a>
          </div>
        </div>
      </div>
    </div>`;
}

async function loadCompanions(targetId) {
  const box = document.getElementById(targetId);
  if (!box) return [];
  const res = await apiFetch('/api/companions');
  const companions = res.ok ? await res.json() : [];
  box.innerHTML = companions.length
    ? companions.map(companionCard).join('')
    : `<div class="empty-state">Chưa có companion nào.</div>`;
  return companions;
}

function requireLogin(auth) {
  if (!auth.authenticated) {
    window.location.href = './login.html';
    return false;
  }
  return true;
}

async function initIndexPage() {
  await loadCompanions('companion-grid');
}

async function initSearchPage() {
  let companions = await loadCompanions('companion-grid');
  const keyword = document.getElementById('keyword');
  const form = document.getElementById('search-form');
  const grid = document.getElementById('companion-grid');

  function readFilterValues() {
    const genderEl = document.getElementById('gender');
    const onlineEl = document.getElementById('online');
    const areaEl = document.getElementById('area');

    const genderValue = String(genderEl?.value || '').trim();
    const locationValue = String(areaEl?.value || '').trim();

    let onlineMode = 'all'; // 'all' | 'online' | 'offline'
    if (onlineEl) {
      if (onlineEl.type === 'checkbox') {
        onlineMode = onlineEl.checked ? 'online' : 'all';
      } else {
        const v = String(onlineEl.value || '');
        onlineMode = v === 'true' ? 'online' : v === 'false' ? 'offline' : 'all';
      }
    }

    return { genderValue, onlineMode, locationValue };
  }

  function filterCompanions(data) {
    const { genderValue, onlineMode, locationValue } = readFilterValues();
    return (Array.isArray(data) ? data : [])
      .filter((c) => {
        if (genderValue) {
          // UI có thể là MALE/FEMALE hoặc Nam/Nữ; backend seed hay dùng Nam/Nữ.
          const g = String(c.gender || '').trim();
          const match =
            g === genderValue ||
            (genderValue === 'MALE' && g.toLowerCase() === 'nam') ||
            (genderValue === 'FEMALE' && g.toLowerCase() === 'nữ');
          if (!match) return false;
        }
        if (onlineMode !== 'all') {
          const online = Boolean(c.isOnline === true || c.onlineStatus === true);
          if (onlineMode === 'online' && !online) return false;
          if (onlineMode === 'offline' && online) return false;
        }
        if (locationValue) {
          const loc = String(c.location || c.area || '').trim();
          if (!loc.toLowerCase().includes(locationValue.toLowerCase())) return false;
        }
        return true;
      });
  }

  function renderCompanionList(list) {
    grid.innerHTML = list.length
      ? list.map(companionCard).join('')
      : `<div class="empty-state">Không tìm thấy kết quả phù hợp.</div>`;
  }

  async function runSearch() {
    const q = (keyword.value || '').trim().toLowerCase();
    const params = new URLSearchParams();
    ['serviceType', 'area', 'gender', 'minPrice', 'maxPrice', 'online'].forEach((id) => {
      const value = document.getElementById(id)?.value;
      if (value !== undefined && value !== null && value !== '') params.set(id, value);
    });
    const api = await apiFetch(`/api/companions/search?${params.toString()}`, { headers: {} });
    companions = api.ok ? await api.json() : companions;

    const byText = companions.filter((c) => {
      const text =
        `${c.user?.fullName || ''} ${c.user?.username || ''} ${c.bio || ''} ${c.hobbies || ''}`.toLowerCase();
      return !q || text.includes(q);
    });
    const filtered = filterCompanions(byText);
    renderCompanionList(filtered);
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    await runSearch();
  });

  // lọc ngay khi thay đổi (giữ logic đơn giản, không jQuery)
  ['gender', 'online', 'area'].forEach((id) => {
    document.getElementById(id)?.addEventListener('change', () => {
      const filtered = filterCompanions(companions);
      renderCompanionList(filtered);
    });
  });
}

async function initProfilePage(auth) {
  const id = new URLSearchParams(window.location.search).get('id');
  const box = document.getElementById('profile-container');
  if (!box) return;
  if (!id) {
    box.innerHTML = `<div class="empty-state">Không tìm thấy companion. Thiếu tham số <code>id</code>.</div>`;
    return;
  }
  try {
    const res = await apiFetch(`/api/companions/${id}`);
    const raw = res.ok ? await res.json() : null;
    const companion = unwrapOptionalEntity(raw);
    if (!companion || !companion.user) {
      box.innerHTML = `<div class="empty-state">Không tìm thấy companion phù hợp.</div>`;
      return;
    }

    const name = companion.user?.fullName || companion.user?.username || 'Companion';
    const avg = companion.averageRating;
    const reviewCount = companion.reviewCount || 0;
    const hasRating = avg !== null && avg !== undefined && !Number.isNaN(Number(avg));
    const ratingText = hasRating ? `${Number(avg).toFixed(1)} ★ (${reviewCount})` : 'Chưa có đánh giá';

    const avatar = companion.avatarUrl || companion.portraitImageUrl || '';
    const album = parseCommaUrls(companion.introMediaUrls || '');
    const venues = parseRentalVenuesLines(companion.rentalVenues);
    const onlineBadge = companion.onlineStatus
      ? `<span class="badge text-bg-success"><i class="bi bi-circle-fill me-1" style="font-size:.5rem"></i>Online</span>`
      : `<span class="badge text-bg-secondary"><i class="bi bi-circle-fill me-1" style="font-size:.5rem"></i>Offline</span>`;

    const albumHtml = album.length
      ? `<div class="row g-2 mt-2">
          ${album
            .slice(0, 12)
            .map((u) => {
              const url = escapeHtml(u);
              const isVideo = /\.(mp4|webm|mov)(\?|#|$)/i.test(u) || /\/video\//i.test(u);
              return isVideo
                ? `<div class="col-6 col-md-4">
                     <video class="w-100 rounded border bg-dark" controls preload="metadata" style="aspect-ratio: 4 / 3; object-fit: cover;">
                       <source src="${url}">
                     </video>
                   </div>`
                : `<div class="col-6 col-md-4">
                     <a href="${url}" target="_blank" rel="noopener">
                       <img src="${url}" class="w-100 rounded border" style="aspect-ratio: 4 / 3; object-fit: cover;" alt="media">
                     </a>
                   </div>`;
            })
            .join('')}
        </div>`
      : `<div class="text-muted small mt-2">Chưa có album ảnh/video.</div>`;

    box.innerHTML = `
      <div class="card user-card">
        <div class="card-body p-3 p-md-4">
          <div class="row g-4 align-items-start">
            <div class="col-12 col-md-5 col-lg-4">
              ${
                avatar
                  ? `<img src="${escapeHtml(avatar)}" alt="avatar" class="img-fluid rounded-4 border" style="width:100%; aspect-ratio: 4 / 3; object-fit: cover;">`
                  : `<div class="d-flex align-items-center justify-content-center rounded-4 border" style="width:100%; aspect-ratio: 4 / 3; background:linear-gradient(135deg,#6366f1,#8b5cf6);">
                       <i class="bi bi-person-fill text-white" style="font-size:4rem;"></i>
                     </div>`
              }
              <div class="d-flex flex-wrap gap-2 mt-3 align-items-center">
                ${onlineBadge}
                <span class="badge text-bg-warning">${escapeHtml(ratingText)}</span>
              </div>
              <div class="d-grid gap-2 mt-3">
                <a class="btn btn-primary" href="./booking.html?id=${escapeHtml(companion.id)}"><i class="bi bi-calendar-plus me-1"></i>Đặt lịch</a>
                <div class="d-flex gap-2">
                  <a class="btn btn-outline-warning flex-grow-1" href="./report.html?reportedUserId=${escapeHtml(companion.user?.id || '')}"><i class="bi bi-flag me-1"></i>Tố cáo / SOS</a>
                  ${auth.authenticated ? `<button id="add-favorite-btn" class="btn btn-outline-danger"><i class="bi bi-heart me-1"></i>Yêu thích</button>` : ''}
                </div>
              </div>
              <div id="profile-message" class="mt-3"></div>
            </div>

            <div class="col-12 col-md-7 col-lg-8">
              <div class="d-flex flex-wrap align-items-baseline justify-content-between gap-2">
                <div>
                  <h1 class="h4 mb-1 fw-bold">${escapeHtml(name)}</h1>
                  <div class="text-muted small">@${escapeHtml(companion.user?.username || '')}</div>
                </div>
                <div class="text-end">
                  <div class="small text-muted">Giá</div>
                  <div class="fw-bold text-primary">${escapeHtml(formatCompanionHourlyPriceRange(companion))}</div>
                </div>
              </div>

              <hr class="my-3" />

              <div class="row g-3">
                <div class="col-12">
                  <div class="fw-semibold mb-1">Tiểu sử</div>
                  <div class="text-body">${escapeHtml(companion.bio || 'Chưa có')}</div>
                </div>
                <div class="col-12 col-lg-6">
                  <div class="fw-semibold mb-1">Khu vực</div>
                  <div>${escapeHtml(companion.area || '-')}</div>
                </div>
                <div class="col-6 col-lg-3">
                  <div class="fw-semibold mb-1">Giới tính</div>
                  <div>${escapeHtml(companion.gender || '-')}</div>
                </div>
                <div class="col-6 col-lg-3">
                  <div class="fw-semibold mb-1">Hạng game</div>
                  <div>${escapeHtml(companion.gameRank || '-')}</div>
                </div>
                <div class="col-12 col-lg-6">
                  <div class="fw-semibold mb-1">Sở thích</div>
                  <div>${escapeHtml(companion.hobbies || 'Chưa có')}</div>
                </div>
                <div class="col-12 col-lg-6">
                  <div class="fw-semibold mb-1">Thời gian rảnh</div>
                  <div>${escapeHtml(companion.availability || 'Chưa có')}</div>
                </div>
                <div class="col-12">
                  <div class="fw-semibold mb-1">Dịch vụ</div>
                  <div>${escapeHtml(companion.serviceType || '-')}</div>
                </div>
                <div class="col-12">
                  <div class="fw-semibold mb-2">Nơi thuê (gợi ý)</div>
                  ${
                    venues.length
                      ? `<div class="d-flex flex-wrap gap-2">${venues
                          .slice(0, 24)
                          .map((v) => `<span class="badge bg-light text-dark border">${escapeHtml(v)}</span>`)
                          .join('')}</div>`
                      : `<div class="text-muted small">Companion chưa công bố danh sách trong hồ sơ.</div>`
                  }
                </div>
              </div>

              <hr class="my-4" />

              <div class="d-flex flex-wrap align-items-center justify-content-between gap-2">
                <div class="fw-bold">Album ảnh / video giới thiệu</div>
                ${
                  companion.introVideoUrl
                    ? `<a class="btn btn-sm btn-outline-dark" href="${escapeHtml(companion.introVideoUrl)}" target="_blank" rel="noopener"><i class="bi bi-play-circle me-1"></i>Video giới thiệu</a>`
                    : ''
                }
              </div>
              ${albumHtml}
            </div>
          </div>
        </div>
      </div>`;

    const addBtn = document.getElementById('add-favorite-btn');
    if (addBtn) {
      addBtn.addEventListener('click', async () => {
        const response = await apiFetch(`/api/favorites/${companion.id}`, { method: 'POST', headers: {} });
        if (response.ok) {
          setMessage('profile-message', 'success', 'Đã thêm vào yêu thích');
        } else {
          setMessage('profile-message', 'danger', 'Thêm yêu thích thất bại');
        }
      });
    }
  } catch (err) {
    box.innerHTML = `<div class="empty-state">Không thể tải hồ sơ: ${escapeHtml(err?.message || err || '')}</div>`;
  }
}

async function initBookingPage(auth) {
  if (!requireLogin(auth)) return;
  const params = new URLSearchParams(window.location.search);
  const companionId = params.get('id');
  const companionSelect = document.getElementById('companionId');
  const serviceSelect = document.getElementById('servicePriceId');
  const durationSelect = document.getElementById('duration');
  const servicePriceHint = document.getElementById('booking-service-price-hint');
  const holdAmountHint = document.getElementById('booking-hold-amount-hint');
  let currentServices = [];

  function renderHoldAmountHint() {
    if (!holdAmountHint) return;
    const selected = currentServices.find((s) => String(s.id) === String(serviceSelect?.value)) || currentServices[0];
    const pricePerHour = Number(selected?.pricePerHour || 0);
    const duration = Number(durationSelect?.value || 0);
    if (!selected || !duration || duration < 30) {
      holdAmountHint.textContent = '';
      return;
    }
    const holdAmount = Math.round(pricePerHour * (duration / 60));
    holdAmountHint.textContent = `Tiền cọc tạm giữ: ${holdAmount.toLocaleString('vi-VN')} VND`;
  }
  const companions = await (async () => {
    const res = await apiFetch('/api/companions');
    return res.ok ? res.json() : [];
  })();
  const onlineCompanions = companions.filter((c) => Boolean(c.onlineStatus));
  companionSelect.innerHTML = onlineCompanions
    .map((c) => {
      const name = c.user?.fullName || c.user?.username || `Companion #${c.id}`;
      return `<option value="${c.id}">${escapeHtml(name)}</option>`;
    })
    .join('');
  if (!onlineCompanions.length) {
    companionSelect.innerHTML = `<option value="">Không có companion online</option>`;
    companionSelect.disabled = true;
    setMessage('booking-message', 'warning', 'Hiện chưa có companion online để đặt lịch.');
    return;
  }
  if (companionId) {
    const selectedOnline = onlineCompanions.some((c) => String(c.id) === String(companionId));
    if (selectedOnline) {
      companionSelect.value = companionId;
    } else {
      setMessage('booking-message', 'warning', 'Companion này đang offline, vui lòng chọn companion online khác.');
    }
  }
  const rentalVenueSelect = document.getElementById('rentalVenue');

  async function loadServicesByCompanion(selectedCompanionId) {
    currentServices = [];
    if (!selectedCompanionId) {
      serviceSelect.innerHTML = `<option value="">Chọn companion để tải dịch vụ</option>`;
      if (servicePriceHint) servicePriceHint.textContent = '';
      if (holdAmountHint) holdAmountHint.textContent = '';
      if (rentalVenueSelect) {
        rentalVenueSelect.innerHTML = `<option value="">Chọn companion trước</option>`;
        rentalVenueSelect.disabled = true;
      }
      return;
    }
    const [spRes, compRes] = await Promise.all([
      apiFetch(`/api/companions/${selectedCompanionId}/service-prices`, { headers: {} }),
      apiFetch(`/api/companions/${selectedCompanionId}`, { headers: {} }),
    ]);
    currentServices = spRes.ok ? await spRes.json() : [];
    const detail = unwrapOptionalEntity(compRes.ok ? await compRes.json() : null);
    const venues = parseRentalVenuesLines(detail?.rentalVenues);
    if (rentalVenueSelect) {
      if (!venues.length) {
        rentalVenueSelect.innerHTML = `<option value="">Companion chưa cấu hình nơi thuê</option>`;
        rentalVenueSelect.disabled = true;
        setMessage(
          'booking-message',
          'warning',
          'Companion này chưa cấu hình danh sách nơi thuê trong hồ sơ — không thể đặt lịch cho đến khi họ cập nhật.'
        );
      } else {
        rentalVenueSelect.disabled = false;
        rentalVenueSelect.innerHTML = `<option value="">Chọn nơi thuê</option>${venues
          .map((v) => {
            const esc = escapeHtml(v);
            return `<option value="${esc}">${esc}</option>`;
          })
          .join('')}`;
        setMessage('booking-message', '', '');
      }
    }
    if (!currentServices.length) {
      serviceSelect.innerHTML = `<option value="">Companion chưa cấu hình dịch vụ</option>`;
      if (servicePriceHint) servicePriceHint.textContent = 'Companion này chưa có dịch vụ cố định để đặt.';
      if (holdAmountHint) holdAmountHint.textContent = '';
      return;
    }
    serviceSelect.innerHTML = currentServices
      .map(
        (s) =>
          `<option value="${s.id}">${escapeHtml(s.serviceName || 'Dịch vụ')} - ${Number(s.pricePerHour || 0).toLocaleString('vi-VN')} VND/giờ</option>`
      )
      .join('');
    if (servicePriceHint) {
      const first = currentServices[0];
      servicePriceHint.textContent = `Giá đang chọn: ${Number(first.pricePerHour || 0).toLocaleString('vi-VN')} VND/giờ`;
    }
    renderHoldAmountHint();
  }

  companionSelect?.addEventListener('change', async () => {
    await loadServicesByCompanion(String(companionSelect.value || '').trim());
  });
  serviceSelect?.addEventListener('change', () => {
    const selected = currentServices.find((s) => String(s.id) === String(serviceSelect.value));
    if (servicePriceHint && selected) {
      servicePriceHint.textContent = `Giá đang chọn: ${Number(selected.pricePerHour || 0).toLocaleString('vi-VN')} VND/giờ`;
    }
    renderHoldAmountHint();
  });
  durationSelect?.addEventListener('change', renderHoldAmountHint);
  await loadServicesByCompanion(String(companionSelect.value || '').trim());
  document.getElementById('bookingTime').value = toDateInputValue();

  const locationEnabled = document.getElementById('locationEnabled');
  const locationStreet = document.getElementById('locationStreet');
  const locationProvince = document.getElementById('locationProvince');
  const locationDistrict = document.getElementById('locationDistrict');

  const provinceOptions = [
    'TP. Hồ Chí Minh',
    'Hà Nội',
    'Đà Nẵng',
    'Cần Thơ',
    'Hải Phòng',
    'Bình Dương',
    'Đồng Nai',
    'Khánh Hòa',
    'Thừa Thiên Huế',
    'An Giang',
  ];
  const districtByProvince = {
    'TP. Hồ Chí Minh': [
      'Quận 1',
      'Quận 3',
      'Quận 4',
      'Quận 5',
      'Quận 7',
      'Quận 10',
      'Quận 11',
      'Quận 12',
      'TP Thủ Đức',
      'Bình Thạnh',
      'Gò Vấp',
      'Tân Bình',
      'Tân Phú',
      'Phú Nhuận',
      'Bình Tân',
    ],
    'Hà Nội': [
      'Ba Đình',
      'Hoàn Kiếm',
      'Hai Bà Trưng',
      'Đống Đa',
      'Cầu Giấy',
      'Thanh Xuân',
      'Hoàng Mai',
      'Long Biên',
      'Nam Từ Liêm',
      'Bắc Từ Liêm',
      'Hà Đông',
      'Tây Hồ',
    ],
  };

  function setLocationEnabledState(enabled) {
    if (locationStreet) locationStreet.disabled = !enabled;
    if (locationProvince) locationProvince.disabled = !enabled;
    if (locationDistrict) locationDistrict.disabled = !enabled;
    if (!enabled) {
      if (locationStreet) locationStreet.value = '';
      if (locationProvince) locationProvince.value = '';
      if (locationDistrict) locationDistrict.innerHTML = `<option value="">Chọn quận/huyện</option>`;
    } else if (locationProvince?.value) {
      renderDistrictOptions(locationProvince.value);
    }
  }

  function renderProvinceOptions() {
    if (!locationProvince) return;
    locationProvince.innerHTML =
      `<option value="">Chọn tỉnh/thành</option>` +
      provinceOptions.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('');
  }

  function renderDistrictOptions(province) {
    if (!locationDistrict) return;
    const list = districtByProvince[province] || ['Khác'];
    locationDistrict.innerHTML =
      `<option value="">Chọn quận/huyện</option>` +
      list.map((d) => `<option value="${escapeHtml(d)}">${escapeHtml(d)}</option>`).join('');
  }

  renderProvinceOptions();
  setLocationEnabledState(Boolean(locationEnabled?.checked));
  locationEnabled?.addEventListener('change', () => setLocationEnabledState(Boolean(locationEnabled.checked)));
  locationProvince?.addEventListener('change', () => renderDistrictOptions(locationProvince.value));

  const imageInput = document.getElementById('bookingImage');
  const imagePreviewWrap = document.getElementById('booking-image-preview-wrap');
  const imagePreview = document.getElementById('booking-image-preview');
  const clearImageBtn = document.getElementById('booking-image-clear-btn');
  let previewUrl = '';

  imageInput?.addEventListener('change', () => {
    const file = imageInput.files?.[0];
    if (!file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = '';
      imagePreviewWrap?.classList.add('d-none');
      if (imagePreview) imagePreview.src = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      setMessage('booking-message', 'warning', 'Vui lòng chọn tệp ảnh hợp lệ.');
      imageInput.value = '';
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = '';
      imagePreviewWrap?.classList.add('d-none');
      if (imagePreview) imagePreview.src = '';
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = URL.createObjectURL(file);
    if (imagePreview) imagePreview.src = previewUrl;
    imagePreviewWrap?.classList.remove('d-none');
  });

  clearImageBtn?.addEventListener('click', () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    if (imageInput) imageInput.value = '';
    if (imagePreview) imagePreview.src = '';
    imagePreviewWrap?.classList.add('d-none');
  });

  document.getElementById('booking-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const location = (() => {
      if (!locationEnabled?.checked) return '';
      const street = (locationStreet?.value || '').trim();
      const province = (locationProvince?.value || '').trim();
      const district = (locationDistrict?.value || '').trim();
      return [street, district, province].filter(Boolean).join(', ');
    })();
    const rentalVenue = (document.getElementById('rentalVenue')?.value || '').trim();
    const payload = {
      companionId: String(document.getElementById('companionId').value || '').trim(),
      servicePriceId: String(document.getElementById('servicePriceId').value || '').trim(),
      bookingTime: document.getElementById('bookingTime').value,
      duration: Number(document.getElementById('duration').value),
      rentalVenue,
      location,
      note: document.getElementById('note').value,
    };
    if (!rentalVenue) {
      setMessage('booking-message', 'warning', 'Vui lòng chọn nơi thuê từ danh sách companion cung cấp.');
      return;
    }
    if (!payload.servicePriceId) {
      setMessage('booking-message', 'warning', 'Vui lòng chọn dịch vụ của companion trước khi đặt lịch.');
      return;
    }
    const res = await apiFetch('/api/bookings', { method: 'POST', body: JSON.stringify(payload) });
    if (res.ok) {
      window.location.href = './appointments.html';
    } else {
      const errMsg = await parseApiErrorMessage(res, 'Đặt lịch thất bại. Vui lòng kiểm tra thông tin.');
      setMessage('booking-message', 'danger', errMsg);
    }
  });
}

async function initAppointmentsPage(auth) {
  if (!requireLogin(auth)) return;
  const box = document.getElementById('appointment-list');
  const res = await apiFetch('/api/bookings/me', { headers: {} });
  const bookings = await bookingsMeList(res);
  box.innerHTML = bookings.length
    ? bookings
        .map((b) => {
          const extMax = 120;
          const extApproved = Number(b.extensionMinutesApproved || 0);
          const extRemaining = extMax - extApproved;
          const hasPendingExt = b.pendingExtensionMinutes != null;
          const canRequestExt =
            (b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS') && !hasPendingExt && extRemaining >= 30;
          return `
      <div class="card user-card mb-3"><div class="card-body">
        <h5>${escapeHtml(b.companion?.user?.fullName || b.companion?.user?.username || 'Companion')}</h5>
        <div class="row">
          <div class="col-md-6"><strong>Thời gian:</strong> ${escapeHtml(formatDateTime(b.bookingTime))}</div>
          <div class="col-md-6"><strong>Thời lượng:</strong> ${escapeHtml(b.duration)} phút</div>
          <div class="col-md-6"><strong>Tiền cọc:</strong> ${escapeHtml(Number(b.holdAmount || 0).toLocaleString('vi-VN'))} VND</div>
          <div class="col-md-6"><strong>Nơi thuê:</strong> ${escapeHtml(b.rentalVenue || '-')}</div>
          <div class="col-md-6"><strong>Địa điểm gặp thêm:</strong> ${escapeHtml(b.location || '-')}</div>
          <div class="col-md-6"><strong>Trạng thái:</strong> ${escapeHtml(b.status || '-')}</div>
          <div class="col-md-6"><strong>Dịch vụ:</strong> ${escapeHtml(b.serviceName || '-')}</div>
          <div class="col-md-6"><strong>Giá dịch vụ:</strong> ${Number(b.servicePricePerHour || 0).toLocaleString('vi-VN')} VND/giờ</div>
          <div class="col-12 small text-muted mt-1"><strong>Gia hạn (tối đa ${extMax} phút/đơn):</strong> đã dùng ${extApproved} phút — còn ${Math.max(0, extRemaining)} phút.</div>
          ${hasPendingExt ? `<div class="col-12 small text-warning"><strong>Chờ companion duyệt gia hạn:</strong> +${Number(b.pendingExtensionMinutes)} phút</div>` : ''}
          <div class="col-12 mt-2"><strong>Ghi chú:</strong> ${escapeHtml(b.note || '-')}</div>
        </div>
        <div class="d-flex flex-wrap gap-2 mt-3">
          ${b.status === 'PENDING' || b.status === 'ACCEPTED' ? `<button class="btn btn-outline-danger btn-sm booking-action" data-id="${b.id}" data-action="cancel">Hủy đơn</button>` : ''}
          ${b.status === 'ACCEPTED' ? `<button class="btn btn-outline-primary btn-sm booking-action" data-id="${b.id}" data-action="check-in">Check-in</button>` : ''}
          ${b.status === 'IN_PROGRESS' ? `<button class="btn btn-success btn-sm booking-action" data-id="${b.id}" data-action="check-out">Check-out</button>` : ''}
          ${canRequestExt ? `<button class="btn btn-outline-secondary btn-sm booking-action" data-id="${b.id}" data-action="extend">Xin gia hạn +30 phút</button>` : ''}
          ${hasPendingExt ? `<button class="btn btn-outline-warning btn-sm booking-action" data-id="${b.id}" data-action="extension-cancel">Hủy yêu cầu gia hạn</button>` : ''}
          ${b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS' ? `<a class="btn btn-outline-dark btn-sm" href="./chat.html?bookingId=${b.id}">Chat/Call</a>` : ''}
          ${b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS' ? `<a class="btn btn-danger btn-sm" href="./report.html?reportedUserId=${b.companion?.user?.id || ''}&bookingId=${b.id}&emergency=1"><i class="bi bi-exclamation-octagon me-1"></i>SOS</a>` : ''}
        </div>
      </div></div>`;
        })
        .join('')
    : `<div class="empty-state">Bạn chưa có lịch hẹn nào.</div>`;

  box.querySelectorAll('.booking-action').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const action = btn.getAttribute('data-action');
      let res;
      if (action === 'check-in') {
        res = await apiFetch(`/api/bookings/me/${id}/check-in`, { method: 'PATCH' });
      } else if (action === 'check-out') {
        res = await apiFetch(`/api/bookings/me/${id}/check-out`, { method: 'PATCH' });
      } else if (action === 'extend') {
        res = await apiFetch(`/api/bookings/me/${id}/extension-request`, {
          method: 'POST',
          body: JSON.stringify({ extraMinutes: 30 }),
        });
      } else if (action === 'extension-cancel') {
        res = await apiFetch(`/api/bookings/me/${id}/extension-request/cancel`, { method: 'POST', headers: {} });
      } else {
        res = await apiFetch(`/api/bookings/me/${id}/${action}`, { method: 'PATCH', headers: {} });
      }
      if (!res.ok) {
        const text = await res.text();
        let msg = text || 'Thao tác thất bại';
        try {
          const j = JSON.parse(text);
          if (j.message) msg = j.message;
        } catch (_) {}
        alert(msg);
        return;
      }
      await initAppointmentsPage(auth);
    });
  });
}

async function initFavoritesPage(auth) {
  if (!requireLogin(auth)) return;
  const box = document.getElementById('favorite-list');
  const res = await apiFetch('/api/favorites/me', { headers: {} });
  const list = res.ok ? await res.json() : [];
  box.innerHTML = list.length
    ? list
        .map((item) => {
          const c = item.companion || {};
          const name = c.user?.fullName || c.user?.username || `Companion #${c.id || ''}`;
          return `<div class="card user-card mb-3"><div class="card-body d-flex justify-content-between align-items-center">
            <div><h5 class="mb-1">${escapeHtml(name)}</h5><div class="text-muted">${escapeHtml(c.bio || '')}</div></div>
            <div class="d-flex gap-2">
                <a href="./profile.html?id=${c.id}" class="btn btn-outline-primary btn-sm">Xem</a>
                <button class="btn btn-outline-danger btn-sm remove-favorite" data-id="${c.id}">Xóa</button>
            </div>
        </div></div>`;
        })
        .join('')
    : `<div class="empty-state">Danh sách yêu thích trống.</div>`;
  box.querySelectorAll('.remove-favorite').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const del = await apiFetch(`/api/favorites/${id}`, { method: 'DELETE', headers: {} });
      if (del.ok) {
        await initFavoritesPage(auth);
      }
    });
  });
}

function renderStars(targetId, value) {
  const root = document.getElementById(targetId);
  if (!root) return;
  root.querySelectorAll('.star-btn').forEach((btn) => {
    const star = Number(btn.getAttribute('data-value'));
    btn.classList.toggle('active', star <= value);
  });
}

async function initReviewPage(auth) {
  if (!requireLogin(auth)) return;
  let selectedRating = 5;
  renderStars('rating-stars', selectedRating);
  document.querySelectorAll('#rating-stars .star-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedRating = Number(btn.getAttribute('data-value'));
      renderStars('rating-stars', selectedRating);
    });
  });

  const bookingSelect = document.getElementById('bookingId');
  const bookingsRes = await apiFetch('/api/bookings/me', { headers: {} });
  const bookings = await bookingsMeList(bookingsRes);
  const completed = bookings.filter((b) => b.status === 'COMPLETED');
  bookingSelect.innerHTML = completed
    .map(
      (b) =>
        `<option value="${b.id}">#${b.id} - ${escapeHtml(b.companion?.user?.username || 'Companion')} (${escapeHtml(formatDateTime(b.bookingTime))})</option>`
    )
    .join('');
  if (!completed.length) {
    bookingSelect.innerHTML = `<option value="">Không có lịch hẹn đã hoàn thành</option>`;
  }

  document.getElementById('review-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const bookingId = String(bookingSelect.value || '').trim();
    if (!bookingId) {
      setMessage('review-message', 'warning', 'Bạn cần có lịch hẹn COMPLETED để đánh giá.');
      return;
    }
    const payload = {
      bookingId,
      rating: selectedRating,
      comment: document.getElementById('comment').value,
    };
    const res = await apiFetch('/api/reviews', { method: 'POST', body: JSON.stringify(payload) });
    if (res.ok) {
      setMessage('review-message', 'success', 'Gửi đánh giá thành công.');
      document.getElementById('review-form').reset();
      selectedRating = 5;
      renderStars('rating-stars', selectedRating);
      await loadMyReviews();
    } else {
      const text = await res.text();
      setMessage('review-message', 'danger', text || 'Gửi đánh giá thất bại.');
    }
  });

  async function loadMyReviews() {
    const res = await apiFetch('/api/reviews/me', { headers: {} });
    const reviews = res.ok ? await res.json() : [];
    const box = document.getElementById('review-list');
    box.innerHTML = reviews.length
      ? reviews
          .map(
            (r) => `
            <div class="card user-card mb-2"><div class="card-body">
              <div><strong>Booking #${r.booking?.id || '-'}</strong> - ${'★'.repeat(r.rating || 0)}</div>
              <div class="text-muted small">${escapeHtml(formatDateTime(r.createdAt))}</div>
              <div>${escapeHtml(r.comment || '')}</div>
            </div></div>`
          )
          .join('')
      : `<div class="empty-state">Bạn chưa có đánh giá nào.</div>`;
  }

  await loadMyReviews();
}

async function initReportPage(auth) {
  if (!requireLogin(auth)) return;
  const params = new URLSearchParams(window.location.search);
  const reportedUserInput = document.getElementById('reportedUserId');
  if (params.get('reportedUserId')) {
    reportedUserInput.value = params.get('reportedUserId');
  }
  async function buildEmergencyReasonFromBooking(bookingId) {
    if (!bookingId) return 'SOS khẩn cấp. Cần hỗ trợ ngay.';
    const res = await apiFetch('/api/bookings/me', { headers: {} });
    const bookings = await bookingsMeList(res);
    const booking = bookings.find((b) => Number(b.id) === Number(bookingId));
    if (!booking) {
      return `Booking #${bookingId} · Yêu cầu hỗ trợ khẩn.`;
    }
    const partner =
      booking.companion?.user?.fullName ||
      booking.companion?.user?.username ||
      `Companion #${booking.companion?.id || '-'}`;
    return `Booking #${booking.id} · ${partner}\nGiờ hẹn: ${formatDateTime(booking.bookingTime)}\nĐịa điểm hẹn: ${booking.location || '—'}\n→ Cần hỗ trợ khẩn.`;
  }

  document.getElementById('isEmergency')?.addEventListener('change', (ev) => {
    if (ev.target.checked) {
      primeReporterGeolocationFromGesture();
    }
  });

  document.getElementById('quick-sos-toggle')?.addEventListener('click', async () => {
    const emergencyCheckbox = document.getElementById('isEmergency');
    if (emergencyCheckbox) emergencyCheckbox.checked = true;
    primeReporterGeolocationFromGesture();
    const reason = document.getElementById('reason');
    if (reason && !reason.value.trim()) {
      const bookingIdFromQuery = new URLSearchParams(window.location.search).get('bookingId');
      reason.value = await buildEmergencyReasonFromBooking(bookingIdFromQuery);
    }
    reason?.focus();
  });
  const emergencyQuick = params.get('emergency') === '1';
  const bookingIdFromQuery = params.get('bookingId');
  if (emergencyQuick) {
    const emergencyCheckbox = document.getElementById('isEmergency');
    if (emergencyCheckbox) emergencyCheckbox.checked = true;
    const category = document.getElementById('reportCategory');
    if (category) category.value = 'OTHER';
    const reason = document.getElementById('reason');
    if (reason && !reason.value.trim()) {
      reason.value = await buildEmergencyReasonFromBooking(bookingIdFromQuery);
    }
  }
  document.getElementById('report-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const isEmergency = document.getElementById('isEmergency').checked;
    let reporterLatitude = null;
    let reporterLongitude = null;
    /** Bắt đầu geolocation ngay (cùng lượt với nút Gửi) để trình duyệt hỏi quyền. */
    const gpsPromise = isEmergency ? getReporterGps() : null;
    if (isEmergency) {
      const insecure = !window.isSecureContext;
      if (insecure) {
        setMessage(
          'report-message',
          'warning',
          'Trang đang không ở “ngữ cảnh bảo mật” (secure context). Trình duyệt không cho GPS trên HTTP với IP LAN (vd: http://192.168…) — chỉ cho phép HTTPS hoặc http://localhost / http://127.0.0.1. Hãy mở site bằng một trong các cách đó để gửi tọa độ cho admin.'
        );
      } else {
        setMessage(
          'report-message',
          'info',
          'Đang lấy vị trí từ thiết bị… Chọn “Cho phép” khi trình duyệt hỏi (ngoài trời có thể ~30 giây).'
        );
      }
      const pos = await gpsPromise;
      reporterLatitude = pos.lat;
      reporterLongitude = pos.lng;
      if (await reporterIsLikelyDenied()) {
        setMessage(
          'report-message',
          'warning',
          'Có vẻ bạn đã chặn định vị. Mở biểu tượng khóa bên cạnh địa chỉ → Cho phép “Vị trí” → thử gửi SOS lại.'
        );
      } else if (reporterLatitude == null || reporterLongitude == null) {
        let msg = 'Chưa lấy được tọa độ — báo cáo vẫn được gửi. Bật dịch vụ vị trí trên máy, Wi‑Fi/mạng, rồi thử lại.';
        if (insecure) {
          msg += ' Thử HTTPS, hoặc http://localhost / 127.0.0.1 (HTTP tới IP LAN thường bị chặn GPS).';
        }
        setMessage('report-message', 'warning', msg);
      } else {
        setMessage('report-message', '', '');
      }
    }
    const bookingIdParam = params.get('bookingId');
    const payload = {
      reportedUserId: String(reportedUserInput.value || '').trim(),
      reason: document.getElementById('reason').value,
      category: document.getElementById('reportCategory').value,
      emergency: isEmergency,
      bookingId: bookingIdParam ? String(bookingIdParam).trim() : null,
      reporterLatitude,
      reporterLongitude,
    };
    const res = await apiFetch('/api/reports', { method: 'POST', body: JSON.stringify(payload) });
    if (res.ok) {
      setMessage('report-message', 'success', 'Gửi tố cáo thành công.');
      document.getElementById('report-form').reset();
      await loadMyReports();
    } else {
      const text = await res.text();
      setMessage('report-message', 'danger', text || 'Gửi tố cáo thất bại.');
    }
  });

  async function loadMyReports() {
    const res = await apiFetch('/api/reports/me', { headers: {} });
    const reports = res.ok ? await res.json() : [];
    const box = document.getElementById('report-list');
    box.innerHTML = reports.length
      ? reports
          .map(
            (r) => `
            <div class="card user-card mb-2"><div class="card-body">
              <div><strong>Tố cáo user #${r.reportedUser?.id || '-'}</strong> - ${escapeHtml(r.status || 'PENDING')}</div>
              <div><strong>Loại:</strong> ${escapeHtml(r.category || 'OTHER')} ${r.emergency ? '<span class="badge bg-danger">SOS</span>' : ''}</div>
              <div class="text-muted small">${escapeHtml(formatDateTime(r.createdAt))}</div>
              ${r.reporterLatitude != null && r.reporterLongitude != null ? `<div class="small mb-1"><a href="https://www.google.com/maps?q=${encodeURIComponent(String(r.reporterLatitude) + ',' + String(r.reporterLongitude))}" target="_blank" rel="noopener">Vị trí GPS lúc gửi</a></div>` : ''}
              <div class="report-reason-text">${escapeHtml(r.reason || '').replace(/\n/g, '<br>')}</div>
            </div></div>`
          )
          .join('')
      : `<div class="empty-state">Bạn chưa gửi tố cáo nào.</div>`;
  }

  await loadMyReports();
}

async function initChatPage(auth) {
  if (!requireLogin(auth)) return;
  const params = new URLSearchParams(window.location.search);
  const bookingIdText = document.getElementById('chat-booking-id-text');
  const threadTitle = document.getElementById('chat-thread-title');
  const threadListBox = document.getElementById('chat-thread-list');
  let currentBookingId = Number(params.get('bookingId') || 0);
  let threads = [];
  let chatStompSub = null;
  let chatPollTimer = null;

  async function resubscribeChatSocket() {
    if (chatStompSub && typeof chatStompSub.unsubscribe === 'function') {
      try {
        chatStompSub.unsubscribe();
      } catch (_) {}
      chatStompSub = null;
    }
    if (!currentBookingId || !window.RealtimeStomp) return;
    try {
      await RealtimeStomp.connect();
      chatStompSub = await RealtimeStomp.subscribeChat(currentBookingId, () => loadMessages());
    } catch (e) {
      console.warn('WebSocket chat không khả dụng', e);
    }
  }

  function normalizeThreads(list) {
    return (Array.isArray(list) ? list : [])
      .map((b) => {
        const partner =
          b.customer?.username || b.companion?.user?.username || b.companion?.user?.fullName || 'Đối phương';
        return {
          bookingId: Number(b.id || 0),
          partnerName: partner,
          status: b.status || '-',
          bookingTime: b.bookingTime,
        };
      })
      .filter((t) => t.bookingId > 0);
  }

  function renderThreadList() {
    if (!threadListBox) return;
    if (!threads.length) {
      threadListBox.innerHTML = `<div class="p-3 text-muted">Chưa có cuộc trò chuyện nào.</div>`;
      return;
    }
    threadListBox.innerHTML = threads
      .map((t) => {
        const active = t.bookingId === currentBookingId ? 'bg-light' : '';
        return `<button type="button" class="list-group-item list-group-item-action border-0 border-bottom ${active} chat-thread-item" data-booking-id="${t.bookingId}">
                <div class="fw-semibold">${escapeHtml(t.partnerName)}</div>
                <div class="small text-muted">Booking #${t.bookingId} - ${escapeHtml(t.status)}</div>
                <div class="small text-muted">${escapeHtml(formatDateTime(t.bookingTime))}</div>
            </button>`;
      })
      .join('');
    threadListBox.querySelectorAll('.chat-thread-item').forEach((btn) => {
      btn.addEventListener('click', async () => {
        currentBookingId = Number(btn.getAttribute('data-booking-id'));
        updateThreadHeader();
        renderThreadList();
        await loadMessages();
        await resubscribeChatSocket();
      });
    });
  }

  function updateThreadHeader() {
    bookingIdText.textContent = currentBookingId ? String(currentBookingId) : '-';
    const thread = threads.find((t) => t.bookingId === currentBookingId);
    threadTitle.textContent = thread ? thread.partnerName : 'Chưa chọn cuộc trò chuyện';
  }

  async function loadChatThreads() {
    const results = [];
    const myBookingsRes = await apiFetch('/api/bookings/me', { headers: {} });
    results.push(...normalizeThreads(await bookingsMeList(myBookingsRes)));
    const companionBookingsRes = await apiFetch('/api/companions/me/bookings', { headers: {} });
    if (companionBookingsRes.ok) {
      const raw = await companionBookingsRes.json();
      const arr = Array.isArray(raw) ? raw : raw.items ?? [];
      results.push(...normalizeThreads(arr));
    }
    const uniq = new Map();
    results.forEach((item) => {
      if (!uniq.has(item.bookingId)) uniq.set(item.bookingId, item);
    });
    threads = [...uniq.values()].sort((a, b) => new Date(b.bookingTime || 0) - new Date(a.bookingTime || 0));
  }

  async function resolveBookingForChat() {
    if (currentBookingId) return currentBookingId;

    const pickPreferred = (list) => {
      if (!Array.isArray(list) || !list.length) return 0;
      const preferred = list.find((b) => ['IN_PROGRESS', 'ACCEPTED', 'COMPLETED'].includes(b.status));
      return Number((preferred || list[0]).id || 0);
    };

    const myBookingsRes = await apiFetch('/api/bookings/me', { headers: {} });
    const myBookings = await bookingsMeList(myBookingsRes);
    const pickedMine = pickPreferred(myBookings);
    if (pickedMine) return pickedMine;

    const companionBookingsRes = await apiFetch('/api/companions/me/bookings', { headers: {} });
    if (companionBookingsRes.ok) {
      const raw = await companionBookingsRes.json();
      const companionBookings = Array.isArray(raw) ? raw : raw.items ?? [];
      const picked = pickPreferred(companionBookings);
      if (picked) return picked;
    }

    return 0;
  }

  async function loadMessages() {
    const box = document.getElementById('chat-list');
    if (!currentBookingId) {
      box.innerHTML = `<div class="text-muted">Chưa có cuộc trò chuyện.</div>`;
      return;
    }
    const res = await apiFetch(`/api/chat/${currentBookingId}/messages`, { headers: {} });
    const list = res.ok ? await res.json() : [];
    box.innerHTML =
      list
        .map(
          (m) =>
            `<div class="mb-2"><strong>${escapeHtml(m.sender?.username || 'user')}:</strong> ${escapeHtml(m.content)} <span class="text-muted small">(${escapeHtml(formatDateTime(m.createdAt))})</span></div>`
        )
        .join('') || `<div class="text-muted">Chưa có tin nhắn.</div>`;
    box.scrollTop = box.scrollHeight;
  }

  document.getElementById('chat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentBookingId) {
      setMessage('chat-message', 'warning', 'Không tìm thấy booking phù hợp để chat.');
      return;
    }
    const content = document.getElementById('chat-content').value.trim();
    if (!content) return;
    const res = await apiFetch(`/api/chat/${currentBookingId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      document.getElementById('chat-content').value = '';
      await loadMessages();
    } else {
      const text = await res.text();
      setMessage('chat-message', 'danger', text || 'Gửi tin nhắn thất bại');
    }
  });
  document.getElementById('call-btn')?.addEventListener('click', async () => {
    if (!currentBookingId) return;
    const res = await apiFetch(`/api/chat/${currentBookingId}/call`, { headers: {} });
    const box = document.getElementById('call-info');
    if (res.ok) {
      const info = await res.json();
      const companionPhone = info.companionPhone || info.contactPhone || '-';
      box.innerHTML = `<div class="alert alert-success mb-0">VoIP room: <strong>${escapeHtml(info.roomId)}</strong> | token: ${escapeHtml(info.token)}<br><strong>SĐT Companion:</strong> ${escapeHtml(companionPhone)}</div>`;
    } else {
      box.innerHTML = `<div class="alert alert-danger mb-0">${escapeHtml(await res.text())}</div>`;
    }
  });

  await loadChatThreads();
  currentBookingId = await resolveBookingForChat();
  updateThreadHeader();
  renderThreadList();
  if (!currentBookingId) {
    setMessage('chat-message', 'warning', 'Chưa có booking để hiển thị chat.');
  }
  await loadMessages();
  if (window.RealtimeStomp) {
    try {
      await RealtimeStomp.ensureLibs();
      await resubscribeChatSocket();
      if (!chatStompSub) {
        chatPollTimer = setInterval(loadMessages, 3000);
      }
    } catch (e) {
      console.warn('Chat realtime lỗi, dùng polling', e);
      chatPollTimer = setInterval(loadMessages, 3000);
    }
  } else {
    chatPollTimer = setInterval(loadMessages, 3000);
  }
}

async function refreshNotifications() {
  const link = document.getElementById('notification-link');
  const badge = document.getElementById('notification-badge');
  if (!link || !badge) return;
  const res = await apiFetch('/api/user/notifications/me', { headers: {} });
  if (!res.ok) return;
  const list = await res.json();
  const unread = list.filter((n) => !n.isRead).length;
  badge.textContent = String(unread);
  badge.classList.toggle('d-none', unread <= 0);
  link.href = './notifications.html';
  link.onclick = null;
  processRealtimeUserNotifications(list);
}

const userRealtimeNotifState = {
  initialized: false,
  seenIds: new Set(),
};

function getUserToastContainer() {
  let box = document.getElementById('user-realtime-toast-container');
  if (box) return box;
  box = document.createElement('div');
  box.id = 'user-realtime-toast-container';
  box.style.cssText =
    'position:fixed;top:16px;right:16px;z-index:1080;display:flex;flex-direction:column;gap:8px;max-width:360px;';
  document.body.appendChild(box);
  return box;
}

function showUserNotificationToast(notification) {
  const box = getUserToastContainer();
  const item = document.createElement('div');
  item.className = 'shadow rounded-3 border bg-white p-3';
  item.innerHTML = `
        <div class="fw-semibold mb-1"><i class="bi bi-bell-fill text-primary me-2"></i>${escapeHtml(notification.title || 'Thông báo mới')}</div>
        <div class="small text-muted" style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(notification.content || '')}</div>
    `;
  box.appendChild(item);
  setTimeout(() => item.remove(), 4500);
}

function processRealtimeUserNotifications(list) {
  const sorted = [...(Array.isArray(list) ? list : [])].sort(
    (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  );
  if (!userRealtimeNotifState.initialized) {
    sorted.forEach((n) => userRealtimeNotifState.seenIds.add(Number(n.id)));
    userRealtimeNotifState.initialized = true;
    return;
  }
  sorted.forEach((n) => {
    const id = Number(n.id);
    if (!userRealtimeNotifState.seenIds.has(id)) {
      userRealtimeNotifState.seenIds.add(id);
      showUserNotificationToast(n);
    }
  });
}

function notifIcon(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('booking') || t.includes('đặt lịch') || t.includes('lịch hẹn'))
    return { icon: 'bi-calendar-event-fill', bg: 'linear-gradient(135deg, #3b82f6, #6366f1)' };
  if (t.includes('thanh toán') || t.includes('tiền') || t.includes('nạp') || t.includes('wallet'))
    return { icon: 'bi-wallet2', bg: 'linear-gradient(135deg, #10b981, #059669)' };
  if (t.includes('đánh giá') || t.includes('review'))
    return { icon: 'bi-star-fill', bg: 'linear-gradient(135deg, #f59e0b, #f97316)' };
  if (t.includes('báo cáo') || t.includes('report') || t.includes('sos') || t.includes('cảnh cáo'))
    return { icon: 'bi-exclamation-triangle-fill', bg: 'linear-gradient(135deg, #ef4444, #dc2626)' };
  if (t.includes('duyệt') || t.includes('companion'))
    return { icon: 'bi-person-check-fill', bg: 'linear-gradient(135deg, #8b5cf6, #a78bfa)' };
  return { icon: 'bi-bell-fill', bg: 'linear-gradient(135deg, #64748b, #94a3b8)' };
}

async function initNotificationsPage(auth) {
  if (!requireLogin(auth)) return;
  const listBox = document.getElementById('notification-list');
  const countBadge = document.getElementById('unread-count');
  const markAllBtn = document.getElementById('mark-all-read-btn');

  async function loadNotifications() {
    const res = await apiFetch('/api/user/notifications/me', { headers: {} });
    const list = res.ok ? await res.json() : [];
    const unread = list.filter((n) => !n.isRead).length;
    countBadge.textContent = `${unread} chưa đọc`;

    if (!list.length) {
      listBox.innerHTML = `
                <div class="text-center py-5">
                    <i class="bi bi-bell-slash text-muted" style="font-size: 3rem;"></i>
                    <p class="text-muted mt-3 mb-0">Bạn chưa có thông báo nào</p>
                </div>`;
      return;
    }

    listBox.innerHTML = list
      .map((n) => {
        const ic = notifIcon(n.title);
        const timeStr = formatDateTime(n.createdAt);
        return `
            <div class="notif-item d-flex gap-3 align-items-start ${n.isRead ? '' : 'unread'}" data-id="${n.id}" data-read="${n.isRead}">
                <div class="notif-icon text-white" style="background: ${ic.bg};">
                    <i class="bi ${ic.icon}"></i>
                </div>
                <div class="flex-grow-1 min-width-0">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="notif-title">${escapeHtml(n.title)}</div>
                        ${!n.isRead ? '<span class="notif-dot ms-2 mt-2"></span>' : ''}
                    </div>
                    <div class="text-muted small mt-1" style="white-space:pre-wrap;word-break:break-word;">${escapeHtml(n.content)}</div>
                    <div class="notif-time mt-1"><i class="bi bi-clock me-1"></i>${timeStr}</div>
                </div>
            </div>`;
      })
      .join('');

    listBox.querySelectorAll(".notif-item[data-read='false']").forEach((item) => {
      item.addEventListener('click', async () => {
        const id = item.getAttribute('data-id');
        await apiFetch(`/api/user/notifications/${id}/read`, { method: 'PATCH', headers: {} });
        item.classList.remove('unread');
        item.setAttribute('data-read', 'true');
        const dot = item.querySelector('.notif-dot');
        if (dot) dot.remove();
        const res2 = await apiFetch('/api/user/notifications/me', { headers: {} });
        const list2 = res2.ok ? await res2.json() : [];
        const unread2 = list2.filter((nn) => !nn.isRead).length;
        countBadge.textContent = `${unread2} chưa đọc`;
      });
    });
  }

  markAllBtn?.addEventListener('click', async () => {
    await apiFetch('/api/user/notifications/read-all', { method: 'PATCH', headers: {} });
    await loadNotifications();
  });

  await loadNotifications();
}

async function initWalletPage(auth) {
  if (!requireLogin(auth)) return;
  const walletRes = await apiFetch('/api/wallet/me', { headers: {} });
  const wallet = walletRes.ok ? await walletRes.json() : { walletBalance: '0' };
  const bal = wallet.walletBalance ?? wallet.balance ?? 0;
  document.getElementById('wallet-balance').textContent = `${Number(bal || 0).toLocaleString('vi-VN')} VND`;

  document.getElementById('deposit-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      amount: Number(document.getElementById('depositAmount').value),
      provider: document.getElementById('provider').value,
    };
    const res = await apiFetch('/api/wallet/deposit', { method: 'POST', body: JSON.stringify(payload) });
    if (res.ok) {
      setMessage('wallet-message', 'success', 'Nạp tiền thành công');
      document.getElementById('deposit-form').reset();
      await initWalletPage(auth);
    } else {
      const text = await res.text();
      setMessage('wallet-message', 'danger', text || 'Nạp tiền thất bại');
    }
  });

  const txRes = await apiFetch('/api/wallet/me', { headers: {} });
  const wallet2 = txRes.ok ? await txRes.json() : { transactions: [] };
  const txs = Array.isArray(wallet2?.transactions) ? wallet2.transactions : [];
  const box = document.getElementById('wallet-transactions');
  box.innerHTML = txs.length
    ? txs
        .map(
          (t) => `
        <tr>
            <td>${escapeHtml(formatDateTime(t.createdAt))}</td>
            <td>${escapeHtml(t.type || '-')}</td>
            <td>${escapeHtml(t.provider || '-')}</td>
            <td>${escapeHtml(t.description || '-')}</td>
            <td class="${Number(t.amount) < 0 ? 'text-danger' : 'text-success'}">${Number(t.amount || 0).toLocaleString('vi-VN')} VND</td>
        </tr>
    `
        )
        .join('')
    : `<tr><td colspan="5" class="text-muted">Chưa có giao dịch.</td></tr>`;
}

function initAuthPages() {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(loginForm);
      const payload = Object.fromEntries(formData.entries());
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      let result = {};
      try {
        result = await res.json();
      } catch {
        setMessage('auth-message', 'danger', 'Phản hồi từ server không hợp lệ.');
        return;
      }
      if (res.ok && result.token) {
        localStorage.setItem(AUTH_TOKEN_KEY, result.token);
        const u = result.user;
        if (u) {
          localStorage.setItem('role', u.role || '');
          const uid = u._id ?? u.id;
          if (uid != null) localStorage.setItem('userId', String(uid));
        }
        const role = u?.role;
        if (role === 'ADMIN') window.location.href = '../admin/dashboard.html';
        else if (role === 'COMPANION') window.location.href = '../companion/dashboard.html';
        else window.location.href = './index.html';
      } else {
        setMessage('auth-message', 'danger', result.message || 'Đăng nhập thất bại');
      }
    });
  }

  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const formData = new FormData(registerForm);
      const payload = { ...Object.fromEntries(formData.entries()), role: 'CUSTOMER' };
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      let result = {};
      try {
        result = await res.json();
      } catch {
        setMessage('auth-message', 'danger', 'Phản hồi từ server không hợp lệ.');
        return;
      }
      if (res.ok && result.success !== false) {
        window.location.href = './login.html?registered=1';
      } else {
        setMessage('auth-message', 'danger', result.message || 'Đăng ký thất bại');
      }
    });
  }

  const params = new URLSearchParams(window.location.search);
  const registered = params.get('registered');
  if (document.getElementById('auth-message')) {
    if (registered === '1') setMessage('auth-message', 'success', 'Đăng ký thành công, vui lòng đăng nhập.');
  }
}

async function bootstrap() {
  const page = document.body.dataset.page;
  const auth = await getAuth().catch(() => ({ authenticated: false }));
  renderTopNav(auth);
  if (auth.authenticated) {
    await refreshNotifications();
    if (auth.userId && window.RealtimeStomp) {
      try {
        await RealtimeStomp.ensureLibs();
        await RealtimeStomp.connect();
        await RealtimeStomp.subscribeNotifications(Number(auth.userId), (n) => {
          const id = Number(n.id);
          if (!userRealtimeNotifState.seenIds.has(id)) {
            userRealtimeNotifState.seenIds.add(id);
            showUserNotificationToast(n);
          }
          refreshNotifications();
        });
      } catch (e) {
        console.warn('WebSocket thông báo không khả dụng, dùng polling', e);
        setInterval(refreshNotifications, 5000);
      }
    } else {
      setInterval(refreshNotifications, 5000);
    }
  }
  if (page === 'login' || page === 'register') {
    initAuthPages();
    return;
  }
  if (page === 'index') await initIndexPage();
  if (page === 'search') await initSearchPage();
  if (page === 'profile') await initProfilePage(auth);
  if (page === 'booking') await initBookingPage(auth);
  if (page === 'appointments') await initAppointmentsPage(auth);
  if (page === 'favorites') await initFavoritesPage(auth);
  if (page === 'review') await initReviewPage(auth);
  if (page === 'report') await initReportPage(auth);
  if (page === 'wallet') await initWalletPage(auth);
  if (page === 'chat') await initChatPage(auth);
  if (page === 'notifications') await initNotificationsPage(auth);
}

document.addEventListener('DOMContentLoaded', bootstrap);
