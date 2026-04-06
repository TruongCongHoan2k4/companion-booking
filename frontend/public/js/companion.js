async function getJson(url, options = {}) {
  const { headers: hdr, ...rest } = options;
  const token = localStorage.getItem('token');
  const res = await fetch(url, {
    credentials: 'include',
    ...rest,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(hdr || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json.message || text;
    } catch (_) {}
    throw new Error(message);
  }
  if (res.status === 204) {
    return null;
  }
  return res.json();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function showAlert(message, type = 'success') {
  // Toast góc phải màn hình, slide-in từ phải qua, tự biến mất sau vài giây.
  const id = 'cb-toast-container';
  let container = document.getElementById(id);
  if (!container) {
    container = document.createElement('div');
    container.id = id;
    container.className = 'toast-container position-fixed top-0 end-0 p-3';
    container.style.zIndex = '1080';
    document.body.appendChild(container);
  }

  if (!document.getElementById('cb-toast-style')) {
    const style = document.createElement('style');
    style.id = 'cb-toast-style';
    style.textContent = `
      @keyframes cbToastIn { from { transform: translateX(110%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes cbToastOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(110%); opacity: 0; } }
      .cb-toast { animation: cbToastIn .28s ease-out; }
      .cb-toast.cb-hide { animation: cbToastOut .22s ease-in forwards; }
    `;
    document.head.appendChild(style);
  }

  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center text-bg-${type} border-0 cb-toast`;
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');
  toastEl.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">${escapeHtml(message)}</div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" aria-label="Close"></button>
    </div>
  `;
  container.appendChild(toastEl);

  const closeBtn = toastEl.querySelector('button');
  const dismiss = () => {
    toastEl.classList.add('cb-hide');
    setTimeout(() => toastEl.remove(), 260);
  };
  closeBtn?.addEventListener('click', dismiss, { once: true });

  // Ưu tiên dùng Bootstrap Toast nếu có (để hỗ trợ accessibility + pause on hover),
  // nhưng vẫn giữ animation slide-in/out theo CSS ở trên.
  const delay = 3200;
  if (window.bootstrap?.Toast) {
    const toast = new bootstrap.Toast(toastEl, { delay, autohide: true });
    toastEl.addEventListener('hidden.bs.toast', dismiss, { once: true });
    toast.show();
  } else {
    setTimeout(dismiss, delay);
  }
}

function statusBadgeClass(status) {
  if (status === 'APPROVED') {
    return 'text-bg-success';
  }
  if (status === 'PENDING') {
    return 'text-bg-warning';
  }
  if (status === 'REJECTED') {
    return 'text-bg-danger';
  }
  return 'text-bg-secondary';
}

function fmtDateTime(value) {
  if (!value) {
    return '';
  }
  return new Date(value).toLocaleString('vi-VN');
}

function fmtMoneyVnd(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0 ₫';
  return `${n.toLocaleString('vi-VN')} ₫`;
}

const companionChartState = {
  range: 'month',
  bookingChart: null,
  statusChart: null,
  payload: null,
};

function startOfWeekLocal(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function buildCompanionBuckets(range) {
  const now = new Date();
  const buckets = [];
  if (range === 'day') {
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`,
        label: d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }),
      });
    }
  } else if (range === 'week') {
    const current = startOfWeekLocal(now);
    for (let i = 7; i >= 0; i--) {
      const d = new Date(current);
      d.setDate(d.getDate() - i * 7);
      const week = Math.ceil(((d - new Date(d.getFullYear(), 0, 1)) / 86400000 + 1) / 7);
      buckets.push({ key: `${d.getFullYear()}-W${week}`, label: `Tuần ${week}` });
    }
  } else if (range === 'year') {
    for (let i = 4; i >= 0; i--) {
      const y = now.getFullYear() - i;
      buckets.push({ key: String(y), label: String(y) });
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({
        key: `${d.getFullYear()}-${d.getMonth() + 1}`,
        label: d.toLocaleDateString('vi-VN', { month: '2-digit', year: '2-digit' }),
      });
    }
  }
  return buckets;
}

function toCompanionBucketKey(dateValue, range) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return null;
  if (range === 'day') return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  if (range === 'week') {
    const s = startOfWeekLocal(d);
    const week = Math.ceil(((s - new Date(s.getFullYear(), 0, 1)) / 86400000 + 1) / 7);
    return `${s.getFullYear()}-W${week}`;
  }
  if (range === 'year') return String(d.getFullYear());
  return `${d.getFullYear()}-${d.getMonth() + 1}`;
}

async function loadCompanionDashboardCharts() {
  if (typeof Chart === 'undefined') return;
  const range = document.getElementById('companion-chart-range')?.value || companionChartState.range || 'month';
  companionChartState.range = range;
  if (!companionChartState.payload) {
    companionChartState.payload = await getJson('/api/companions/me/bookings');
  }
  const bookings = Array.isArray(companionChartState.payload) ? companionChartState.payload : [];
  const buckets = buildCompanionBuckets(range);
  const labels = buckets.map((b) => b.label);
  const bucketIndex = {};
  buckets.forEach((b, i) => {
    bucketIndex[b.key] = i;
  });

  const acceptedSeries = new Array(labels.length).fill(0);
  const completedSeries = new Array(labels.length).fill(0);
  const incomeSeries = new Array(labels.length).fill(0);
  bookings.forEach((b) => {
    const key = toCompanionBucketKey(b.bookingTime, range);
    const idx = bucketIndex[key];
    if (idx == null) return;
    if (b.status === 'ACCEPTED' || b.status === 'IN_PROGRESS') acceptedSeries[idx] += 1;
    if (b.status === 'COMPLETED') {
      completedSeries[idx] += 1;
      incomeSeries[idx] += Number(b.holdAmount || 0);
    }
  });

  const bookingCtx = document.getElementById('companion-booking-chart');
  if (bookingCtx) {
    companionChartState.bookingChart?.destroy();
    companionChartState.bookingChart = new Chart(bookingCtx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Đơn đang chạy/chấp nhận', data: acceptedSeries, backgroundColor: 'rgba(59,130,246,.7)' },
          { label: 'Đơn hoàn tất', data: completedSeries, backgroundColor: 'rgba(16,185,129,.7)' },
          {
            label: 'Doanh thu (VND)',
            data: incomeSeries,
            type: 'line',
            borderColor: '#f59e0b',
            backgroundColor: 'rgba(245,158,11,.15)',
            yAxisID: 'y1',
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true, position: 'left' },
          y1: { beginAtZero: true, position: 'right', grid: { drawOnChartArea: false } },
        },
      },
    });
  }

  const statusCounts = { PENDING: 0, ACCEPTED: 0, IN_PROGRESS: 0, COMPLETED: 0, REJECTED: 0, CANCELLED: 0 };
  bookings.forEach((b) => {
    if (statusCounts[b.status] != null) statusCounts[b.status] += 1;
  });
  const statusCtx = document.getElementById('companion-status-chart');
  if (statusCtx) {
    companionChartState.statusChart?.destroy();
    companionChartState.statusChart = new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: ['PENDING', 'ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'REJECTED', 'CANCELLED'],
        datasets: [
          {
            data: [
              statusCounts.PENDING,
              statusCounts.ACCEPTED,
              statusCounts.IN_PROGRESS,
              statusCounts.COMPLETED,
              statusCounts.REJECTED,
              statusCounts.CANCELLED,
            ],
            backgroundColor: ['#64748b', '#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#94a3b8'],
          },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
  }
}

async function sendJson(url, method, payload) {
  return getJson(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

const MAX_INTRO_MEDIA_FILES_PER_SAVE = 12;

const companionProfileUploadState = {
  identityFile: null,
  portraitFile: null,
  coverFile: null,
  albumFiles: [],
  retainedIntroUrls: [],
  identityPreviewUrl: null,
  portraitPreviewUrl: null,
  coverPreviewUrl: null,
  albumPreviewUrls: [],
  serverIdentityUrl: '',
  serverPortraitUrl: '',
  serverCoverUrl: '',
};

let companionProfileUploadInited = false;

function splitIntroMediaUrlString(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function revokeBlobUrl(url) {
  if (url && String(url).startsWith('blob:')) {
    try {
      URL.revokeObjectURL(url);
    } catch (_) {}
  }
}

function refreshProfileLucideIcons() {
  if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
    lucide.createIcons();
  }
}

function buildMediaThumb(url, mediaKind, onRemove) {
  const box = document.createElement('div');
  box.className = 'relative inline-block';
  let mediaEl;
  if (mediaKind === 'video') {
    mediaEl = document.createElement('video');
    mediaEl.src = url;
    mediaEl.muted = true;
    mediaEl.playsInline = true;
    mediaEl.className = 'h-28 w-44 max-w-full rounded-lg border border-slate-200 object-cover shadow-sm';
  } else {
    mediaEl = document.createElement('img');
    mediaEl.src = url;
    mediaEl.alt = '';
    mediaEl.className = 'h-28 max-h-32 w-auto max-w-[220px] rounded-lg border border-slate-200 object-cover shadow-sm';
  }
  box.appendChild(mediaEl);
  if (typeof onRemove === 'function') {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className =
      'absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-white bg-red-500 text-xs font-bold leading-none text-white shadow hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300';
    btn.setAttribute('aria-label', 'Xóa');
    btn.textContent = '×';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onRemove();
    });
    box.appendChild(btn);
  }
  return box;
}

function guessVideoUrl(u) {
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(u) || /\/video\//i.test(u);
}

function renderIdentityThumbPreview() {
  const wrap = document.getElementById('identity-image-preview');
  if (!wrap) return;
  wrap.replaceChildren();
  const st = companionProfileUploadState;
  if (st.identityFile && st.identityPreviewUrl) {
    wrap.appendChild(buildMediaThumb(st.identityPreviewUrl, 'image', clearIdentityUploadSelection));
    return;
  }
  if (st.serverIdentityUrl) {
    wrap.appendChild(buildMediaThumb(st.serverIdentityUrl, 'image', null));
  }
}

function renderPortraitThumbPreview() {
  const wrap = document.getElementById('portrait-image-preview');
  if (!wrap) return;
  wrap.replaceChildren();
  const st = companionProfileUploadState;
  if (st.portraitFile && st.portraitPreviewUrl) {
    wrap.appendChild(buildMediaThumb(st.portraitPreviewUrl, 'image', clearPortraitUploadSelection));
    return;
  }
  if (st.serverPortraitUrl) {
    wrap.appendChild(buildMediaThumb(st.serverPortraitUrl, 'image', null));
  }
}

function renderCoverThumbPreview() {
  const wrap = document.getElementById('cover-image-preview');
  if (!wrap) return;
  wrap.replaceChildren();
  const st = companionProfileUploadState;
  if (st.coverFile && st.coverPreviewUrl) {
    wrap.appendChild(buildMediaThumb(st.coverPreviewUrl, 'image', clearCoverUploadSelection));
    return;
  }
  if (st.serverCoverUrl) {
    wrap.appendChild(buildMediaThumb(st.serverCoverUrl, 'image', null));
  }
}

function renderIntroAlbumPreview() {
  const wrap = document.getElementById('intro-media-preview');
  if (!wrap) return;
  wrap.replaceChildren();
  const st = companionProfileUploadState;
  st.retainedIntroUrls.forEach((u, idx) => {
    const kind = guessVideoUrl(u) ? 'video' : 'image';
    wrap.appendChild(
      buildMediaThumb(u, kind, () => {
        st.retainedIntroUrls.splice(idx, 1);
        renderIntroAlbumPreview();
      })
    );
  });
  st.albumFiles.forEach((file, idx) => {
    const url = st.albumPreviewUrls[idx];
    if (!url) return;
    const kind = file.type.startsWith('video/') ? 'video' : 'image';
    wrap.appendChild(
      buildMediaThumb(url, kind, () => {
        revokeBlobUrl(st.albumPreviewUrls[idx]);
        st.albumPreviewUrls.splice(idx, 1);
        st.albumFiles.splice(idx, 1);
        renderIntroAlbumPreview();
      })
    );
  });
  refreshProfileLucideIcons();
}

function clearIdentityUploadSelection() {
  const st = companionProfileUploadState;
  revokeBlobUrl(st.identityPreviewUrl);
  st.identityFile = null;
  st.identityPreviewUrl = null;
  const input = document.getElementById('identity-image-file');
  if (input) input.value = '';
  renderIdentityThumbPreview();
}

function clearPortraitUploadSelection() {
  const st = companionProfileUploadState;
  revokeBlobUrl(st.portraitPreviewUrl);
  st.portraitFile = null;
  st.portraitPreviewUrl = null;
  const input = document.getElementById('portrait-image-file');
  if (input) input.value = '';
  renderPortraitThumbPreview();
}

function clearCoverUploadSelection() {
  const st = companionProfileUploadState;
  revokeBlobUrl(st.coverPreviewUrl);
  st.coverFile = null;
  st.coverPreviewUrl = null;
  const input = document.getElementById('cover-image-file');
  if (input) input.value = '';
  renderCoverThumbPreview();
}

function resetCompanionProfileUploadState() {
  const st = companionProfileUploadState;
  revokeBlobUrl(st.identityPreviewUrl);
  revokeBlobUrl(st.portraitPreviewUrl);
  revokeBlobUrl(st.coverPreviewUrl);
  st.albumPreviewUrls.forEach((u) => revokeBlobUrl(u));
  st.identityFile = null;
  st.portraitFile = null;
  st.coverFile = null;
  st.albumFiles = [];
  st.retainedIntroUrls = [];
  st.identityPreviewUrl = null;
  st.portraitPreviewUrl = null;
  st.coverPreviewUrl = null;
  st.albumPreviewUrls = [];
  st.serverIdentityUrl = '';
  st.serverPortraitUrl = '';
  st.serverCoverUrl = '';
  ['identity-image-file', 'portrait-image-file', 'cover-image-file', 'intro-media-files'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderIdentityThumbPreview();
  renderPortraitThumbPreview();
  renderCoverThumbPreview();
  renderIntroAlbumPreview();
}

function applyProfileMediaFromServer(profile) {
  const st = companionProfileUploadState;
  st.serverIdentityUrl = profile.identityImageUrl || '';
  st.serverPortraitUrl = profile.portraitImageUrl || profile.avatarUrl || '';
  st.serverCoverUrl = profile.coverImageUrl || '';
  st.retainedIntroUrls = splitIntroMediaUrlString(profile.introMediaUrls);
  renderIdentityThumbPreview();
  renderPortraitThumbPreview();
  renderCoverThumbPreview();
  renderIntroAlbumPreview();
}

function bindDropzone(zoneEl, inputEl, onPickFiles) {
  if (!zoneEl || !inputEl) return;
  const activate = () => zoneEl.classList.add('ring-2', 'ring-violet-400', 'ring-offset-2');
  const deactivate = () => zoneEl.classList.remove('ring-2', 'ring-violet-400', 'ring-offset-2');

  zoneEl.addEventListener('click', () => inputEl.click());
  zoneEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputEl.click();
    }
  });
  zoneEl.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
    activate();
  });
  zoneEl.addEventListener('dragleave', (e) => {
    e.preventDefault();
    if (!zoneEl.contains(e.relatedTarget)) deactivate();
  });
  zoneEl.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    deactivate();
    const files = e.dataTransfer?.files;
    if (files?.length) onPickFiles(files);
  });
}

function initCompanionProfileUploads() {
  if (companionProfileUploadInited) return;
  if (document.body.dataset.page !== 'companion-profile') return;
  const idInput = document.getElementById('identity-image-file');
  const portraitInput = document.getElementById('portrait-image-file');
  const coverInput = document.getElementById('cover-image-file');
  const albumInput = document.getElementById('intro-media-files');
  if (!idInput || !portraitInput || !coverInput || !albumInput) return;
  companionProfileUploadInited = true;

  const idZone = document.getElementById('identity-image-dropzone');
  const portraitZone = document.getElementById('portrait-image-dropzone');
  const coverZone = document.getElementById('cover-image-dropzone');
  const albumZone = document.getElementById('intro-media-dropzone');

  bindDropzone(idZone, idInput, (files) => {
    const f = files[0];
    if (!f || !f.type.startsWith('image/')) {
      showAlert('Vui lòng chọn file ảnh cho CCCD.', 'warning');
      return;
    }
    const st = companionProfileUploadState;
    revokeBlobUrl(st.identityPreviewUrl);
    st.identityFile = f;
    st.identityPreviewUrl = URL.createObjectURL(f);
    idInput.value = '';
    renderIdentityThumbPreview();
  });

  idInput.addEventListener('change', () => {
    const f = idInput.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      showAlert('Vui lòng chọn file ảnh cho CCCD.', 'warning');
      idInput.value = '';
      return;
    }
    const st = companionProfileUploadState;
    revokeBlobUrl(st.identityPreviewUrl);
    st.identityFile = f;
    st.identityPreviewUrl = URL.createObjectURL(f);
    renderIdentityThumbPreview();
  });

  bindDropzone(portraitZone, portraitInput, (files) => {
    const f = files[0];
    if (!f || !f.type.startsWith('image/')) {
      showAlert('Vui lòng chọn file ảnh chân dung.', 'warning');
      return;
    }
    const st = companionProfileUploadState;
    revokeBlobUrl(st.portraitPreviewUrl);
    st.portraitFile = f;
    st.portraitPreviewUrl = URL.createObjectURL(f);
    portraitInput.value = '';
    renderPortraitThumbPreview();
  });

  portraitInput.addEventListener('change', () => {
    const f = portraitInput.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      showAlert('Vui lòng chọn file ảnh chân dung.', 'warning');
      portraitInput.value = '';
      return;
    }
    const st = companionProfileUploadState;
    revokeBlobUrl(st.portraitPreviewUrl);
    st.portraitFile = f;
    st.portraitPreviewUrl = URL.createObjectURL(f);
    renderPortraitThumbPreview();
  });

  bindDropzone(coverZone, coverInput, (files) => {
    const f = files[0];
    if (!f || !f.type.startsWith('image/')) {
      showAlert('Vui lòng chọn file ảnh bìa.', 'warning');
      return;
    }
    const st = companionProfileUploadState;
    revokeBlobUrl(st.coverPreviewUrl);
    st.coverFile = f;
    st.coverPreviewUrl = URL.createObjectURL(f);
    coverInput.value = '';
    renderCoverThumbPreview();
  });

  coverInput.addEventListener('change', () => {
    const f = coverInput.files?.[0];
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      showAlert('Vui lòng chọn file ảnh bìa.', 'warning');
      coverInput.value = '';
      return;
    }
    const st = companionProfileUploadState;
    revokeBlobUrl(st.coverPreviewUrl);
    st.coverFile = f;
    st.coverPreviewUrl = URL.createObjectURL(f);
    renderCoverThumbPreview();
  });

  const acceptAlbumMime = (f) => f.type.startsWith('image/') || f.type.startsWith('video/');

  bindDropzone(albumZone, albumInput, (files) => {
    const st = companionProfileUploadState;
    const incoming = Array.from(files).filter(acceptAlbumMime);
    if (!incoming.length) {
      showAlert('Chỉ chấp nhận ảnh hoặc video cho album.', 'warning');
      return;
    }
    let added = 0;
    for (const f of incoming) {
      if (st.albumFiles.length >= MAX_INTRO_MEDIA_FILES_PER_SAVE) break;
      st.albumFiles.push(f);
      st.albumPreviewUrls.push(URL.createObjectURL(f));
      added += 1;
    }
    if (added < incoming.length) {
      showAlert(`Chỉ thêm được tối đa ${MAX_INTRO_MEDIA_FILES_PER_SAVE} file mới mỗi lần lưu.`, 'info');
    }
    albumInput.value = '';
    renderIntroAlbumPreview();
  });

  albumInput.addEventListener('change', () => {
    const st = companionProfileUploadState;
    const incoming = Array.from(albumInput.files || []).filter(acceptAlbumMime);
    if (!incoming.length && albumInput.files?.length) {
      showAlert('Chỉ chấp nhận ảnh hoặc video cho album.', 'warning');
      albumInput.value = '';
      return;
    }
    let added = 0;
    for (const f of incoming) {
      if (st.albumFiles.length >= MAX_INTRO_MEDIA_FILES_PER_SAVE) break;
      st.albumFiles.push(f);
      st.albumPreviewUrls.push(URL.createObjectURL(f));
      added += 1;
    }
    if (added < incoming.length) {
      showAlert(`Chỉ thêm được tối đa ${MAX_INTRO_MEDIA_FILES_PER_SAVE} file mới mỗi lần lưu.`, 'info');
    }
    albumInput.value = '';
    renderIntroAlbumPreview();
  });

  refreshProfileLucideIcons();
}

async function putCompanionIdentityFormData(formData) {
  const token = localStorage.getItem('token');
  const res = await fetch('/api/companions/me/identity', {
    method: 'PUT',
    credentials: 'include',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_) {
    body = { message: text };
  }
  if (!res.ok) {
    throw new Error(body?.message || text || 'Cập nhật định danh thất bại.');
  }
  return body;
}

async function loadProfile() {
  try {
    const profile = await getJson('/api/companions/me/profile');
    document.getElementById('bio').value = profile.bio || '';
    document.getElementById('hobbies').value = profile.hobbies || '';
    document.getElementById('appearance').value = profile.appearance || '';
    document.getElementById('availability-text').value = profile.availability || '';
    document.getElementById('service-type').value = profile.serviceType || '';
    document.getElementById('area').value = profile.area || '';
    const rv = document.getElementById('rental-venues');
    if (rv) rv.value = profile.rentalVenues || '';
    document.getElementById('identity-number').value = profile.identityNumber || '';
    document.getElementById('skills').value = profile.skills || '';
    const onlineToggle = document.getElementById('online-toggle');
    if (onlineToggle) {
      onlineToggle.checked = !!(profile.onlineStatus ?? profile.online);
    }
    const statusEl = document.getElementById('companion-status');
    if (statusEl) {
      statusEl.className = `badge ${statusBadgeClass(profile.status)}`;
      statusEl.textContent = profile.status || 'N/A';
    }
    revokeBlobUrl(companionProfileUploadState.identityPreviewUrl);
    revokeBlobUrl(companionProfileUploadState.portraitPreviewUrl);
    revokeBlobUrl(companionProfileUploadState.coverPreviewUrl);
    companionProfileUploadState.albumPreviewUrls.forEach((u) => revokeBlobUrl(u));
    companionProfileUploadState.identityFile = null;
    companionProfileUploadState.portraitFile = null;
    companionProfileUploadState.coverFile = null;
    companionProfileUploadState.albumFiles = [];
    companionProfileUploadState.identityPreviewUrl = null;
    companionProfileUploadState.portraitPreviewUrl = null;
    companionProfileUploadState.coverPreviewUrl = null;
    companionProfileUploadState.albumPreviewUrls = [];
    const idIn = document.getElementById('identity-image-file');
    const prIn = document.getElementById('portrait-image-file');
    const cvIn = document.getElementById('cover-image-file');
    const alIn = document.getElementById('intro-media-files');
    if (idIn) idIn.value = '';
    if (prIn) prIn.value = '';
    if (cvIn) cvIn.value = '';
    if (alIn) alIn.value = '';
    applyProfileMediaFromServer(profile);
    refreshProfileLucideIcons();
  } catch (err) {
    showAlert(`Không thể tải hồ sơ: ${err.message || err}`, 'danger');
    document.getElementById('bio').value = '';
    document.getElementById('hobbies').value = '';
    document.getElementById('appearance').value = '';
    document.getElementById('availability-text').value = '';
    const rv = document.getElementById('rental-venues');
    if (rv) rv.value = '';
    const statusEl = document.getElementById('companion-status');
    if (statusEl) {
      statusEl.className = 'badge text-bg-secondary';
      statusEl.textContent = 'N/A';
    }
    resetCompanionProfileUploadState();
  }
}

async function saveProfile(e) {
  e.preventDefault();
  const onlineToggle = document.getElementById('online-toggle');
  const payload = {
    bio: document.getElementById('bio').value.trim(),
    hobbies: document.getElementById('hobbies').value.trim(),
    appearance: document.getElementById('appearance').value.trim(),
    availability: document.getElementById('availability-text').value.trim(),
    serviceType: document.getElementById('service-type').value.trim(),
    area: document.getElementById('area').value.trim(),
    rentalVenues: (document.getElementById('rental-venues')?.value || '').trim(),
  };
  if (onlineToggle) {
    payload.onlineStatus = String(onlineToggle.checked);
  }
  try {
    await sendJson('/api/companions/me/profile', 'PUT', payload);

    const st = companionProfileUploadState;
    const fd = new FormData();
    fd.append('identityNumber', document.getElementById('identity-number').value.trim());
    fd.append('introMediaUrls', st.retainedIntroUrls.join(','));
    if (st.identityFile) {
      fd.append('identityImage', st.identityFile, st.identityFile.name);
    }
    if (st.portraitFile) {
      fd.append('avatar', st.portraitFile, st.portraitFile.name);
    }
    if (st.coverFile) {
      fd.append('cover', st.coverFile, st.coverFile.name);
    }
    st.albumFiles.forEach((file) => {
      fd.append('introMedia', file, file.name);
    });

    const identityJson = await putCompanionIdentityFormData(fd);

    await sendJson('/api/companions/me/media-skills', 'PUT', {
      skills: document.getElementById('skills').value.trim(),
    });

    if (identityJson?.companion) {
      const c = identityJson.companion;
      st.serverIdentityUrl = c.identityImageUrl || st.serverIdentityUrl;
      st.serverPortraitUrl = c.portraitImageUrl || c.avatarUrl || st.serverPortraitUrl;
      st.serverCoverUrl = c.coverImageUrl || st.serverCoverUrl;
      if (c.introMediaUrls != null) {
        st.retainedIntroUrls = splitIntroMediaUrlString(c.introMediaUrls);
      }
    }

    revokeBlobUrl(st.identityPreviewUrl);
    revokeBlobUrl(st.portraitPreviewUrl);
    revokeBlobUrl(st.coverPreviewUrl);
    st.albumPreviewUrls.forEach((u) => revokeBlobUrl(u));
    st.identityFile = null;
    st.portraitFile = null;
    st.coverFile = null;
    st.albumFiles = [];
    st.identityPreviewUrl = null;
    st.portraitPreviewUrl = null;
    st.coverPreviewUrl = null;
    st.albumPreviewUrls = [];
    const idIn = document.getElementById('identity-image-file');
    const prIn = document.getElementById('portrait-image-file');
    const cvIn = document.getElementById('cover-image-file');
    const alIn = document.getElementById('intro-media-files');
    if (idIn) idIn.value = '';
    if (prIn) prIn.value = '';
    if (cvIn) cvIn.value = '';
    if (alIn) alIn.value = '';
    renderIdentityThumbPreview();
    renderPortraitThumbPreview();
    renderCoverThumbPreview();
    renderIntroAlbumPreview();

    showAlert('Đã cập nhật hồ sơ companion.');
    await loadProfile();
  } catch (err) {
    showAlert(`Không thể lưu hồ sơ: ${err.message || err}`, 'danger');
  }
}

async function updateOnlineStatus() {
  const onlineToggle = document.getElementById('online-toggle');
  if (!onlineToggle) return;
  await sendJson('/api/companions/me/online', 'PATCH', {
    online: onlineToggle.checked,
  });
  showAlert('Đã cập nhật trạng thái online.');
}

async function loadOnlineState() {
  const onlineToggle = document.getElementById('online-toggle');
  const badge = document.getElementById('online-state-badge');
  const hint = document.getElementById('online-state-hint');
  if (!onlineToggle && !badge && !hint) return;
  try {
    const profile = await getJson('/api/companions/me/profile');
    const isOnline = Boolean(profile?.onlineStatus ?? profile?.online);
    if (onlineToggle) onlineToggle.checked = isOnline;
    if (badge) {
      badge.className = `badge ${isOnline ? 'text-bg-success' : 'text-bg-secondary'}`;
      badge.textContent = isOnline ? 'ONLINE' : 'OFFLINE';
    }
    if (hint) {
      hint.textContent = isOnline ? 'Bạn đang sẵn sàng nhận booking mới.' : 'Bạn đang tạm ẩn. Bật Online để nhận booking.';
    }
  } catch (err) {
    if (hint) hint.textContent = 'Không thể tải trạng thái online.';
  }
}

async function loadAvailabilities() {
  const rows = document.getElementById('availability-body');
  const modeHint = document.getElementById('availability-mode-hint');
  const profile = await getJson('/api/companions/me/profile');
  const bookings = await getJson('/api/companions/me/bookings');
  rows.innerHTML = '';

  if (modeHint) {
    if (profile?.online || profile?.onlineStatus) {
      modeHint.innerHTML =
        '<span class="badge text-bg-success me-2">ONLINE</span>Bạn đang online, hệ thống mặc định bạn rảnh toàn bộ ngoài các khung giờ bận bên dưới.';
    } else {
      modeHint.innerHTML =
        '<span class="badge text-bg-secondary me-2">OFFLINE</span>Bạn đang offline. Bật online để sẵn sàng nhận booking mới.';
    }
  }

  const busyStatuses = new Set(['PENDING', 'ACCEPTED', 'IN_PROGRESS']);
  const busySlots = (Array.isArray(bookings) ? bookings : [])
    .filter((b) => busyStatuses.has(b.status))
    .map((b) => {
      const start = b.bookingTime ? new Date(b.bookingTime) : null;
      const end = start ? new Date(start.getTime() + Number(b.duration || 0) * 60000) : null;
      return {
        id: b.id,
        start,
        end,
        status: b.status,
        customerName: b.customer?.fullName || b.customer?.username || 'Khách hàng',
        location: b.location || '-',
      };
    })
    .filter((x) => x.start && x.end)
    .sort((a, b) => a.start - b.start);

  // Calendar view (week time-grid): hiển thị rảnh/bận theo booking.
  const cal = document.getElementById('availability-calendar');
  const labelEl = document.getElementById('avail-week-label');
  const prevBtn = document.getElementById('avail-prev-week');
  const nextBtn = document.getElementById('avail-next-week');
  const todayBtn = document.getElementById('avail-today');
  const hourStart = 0; // 00:00
  const hourEnd = 24; // 24:00 (không inclusive)
  const pxPerHour = 60;

  if (!window.__cbAvailState) {
    window.__cbAvailState = { anchor: new Date() };
  }

  function startOfWeekMonday(d) {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7; // Monday=0
    x.setDate(x.getDate() - day);
    x.setHours(0, 0, 0, 0);
    return x;
  }

  function fmtDayHeader(d) {
    const dow = d.toLocaleDateString('vi-VN', { weekday: 'short' });
    const ddmm = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    return { dow, ddmm };
  }

  function intersects(slot, dayStart, dayEnd) {
    return slot.end > dayStart && slot.start < dayEnd;
  }

  function clampToRange(date, min, max) {
    const t = date.getTime();
    if (t < min.getTime()) return new Date(min);
    if (t > max.getTime()) return new Date(max);
    return date;
  }

  function renderWeek() {
    if (!cal) return;
    const anchor = window.__cbAvailState.anchor || new Date();
    const weekStart = startOfWeekMonday(anchor);
    const days = Array.from({ length: 7 }, (_, i) => new Date(weekStart.getTime() + i * 86400000));

    const weekEnd = new Date(days[6].getTime());
    weekEnd.setHours(23, 59, 59, 999);
    if (labelEl) {
      const a = days[0].toLocaleDateString('vi-VN');
      const b = days[6].toLocaleDateString('vi-VN');
      labelEl.textContent = `${a} → ${b}`;
    }

    // Header
    const header = document.createElement('div');
    header.className = 'cb-avail-header';
    header.innerHTML = `<div class="cell"></div>${days
      .map((d) => {
        const h = fmtDayHeader(d);
        return `<div class="cell"><div class="dow"><span>${escapeHtml(h.dow)}</span><span class="date">${escapeHtml(
          h.ddmm
        )}</span></div></div>`;
      })
      .join('')}`;

    // Grid
    const grid = document.createElement('div');
    grid.className = 'cb-avail-grid';
    grid.style.height = `${(hourEnd - hourStart) * pxPerHour}px`;

    // Time column
    const timeCol = document.createElement('div');
    timeCol.className = 'time-col';
    timeCol.style.position = 'relative';
    timeCol.style.background = '#fff';
    for (let h = hourStart; h <= hourEnd; h++) {
      const y = (h - hourStart) * pxPerHour;
      const line = document.createElement('div');
      line.className = 'hour-line';
      line.style.top = `${y}px`;
      timeCol.appendChild(line);
      if (h < hourEnd) {
        const lab = document.createElement('div');
        lab.className = 'hour-label';
        lab.style.top = `${y}px`;
        lab.textContent = `${String(h).padStart(2, '0')}:00`;
        timeCol.appendChild(lab);
      }
    }
    grid.appendChild(timeCol);

    // Day columns + busy blocks
    days.forEach((day) => {
      const dayCol = document.createElement('div');
      dayCol.className = 'day-col';
      dayCol.style.position = 'relative';

      const dayStart = new Date(day);
      const dayEnd = new Date(dayStart.getTime() + 86400000);

      // Hour lines
      for (let h = hourStart; h <= hourEnd; h++) {
        const y = (h - hourStart) * pxPerHour;
        const line = document.createElement('div');
        line.className = 'hour-line';
        line.style.top = `${y}px`;
        dayCol.appendChild(line);
      }

      // Busy blocks
      const viewStart = new Date(dayStart);
      viewStart.setHours(hourStart, 0, 0, 0);
      const viewEnd = new Date(dayStart);
      viewEnd.setHours(hourEnd, 0, 0, 0);

      const daySlots = busySlots.filter((s) => intersects(s, dayStart, dayEnd));
      daySlots.forEach((s) => {
        const s0 = clampToRange(s.start, viewStart, viewEnd);
        const e0 = clampToRange(s.end, viewStart, viewEnd);
        const minutes = Math.max(10, Math.round((e0.getTime() - s0.getTime()) / 60000));
        const topMin = Math.round((s0.getHours() * 60 + s0.getMinutes()) - hourStart * 60);
        const top = (topMin / 60) * pxPerHour;
        const height = (minutes / 60) * pxPerHour;
        // Không render nếu nằm ngoài khung giờ hiển thị
        if (height <= 2 || top + height <= 0 || top >= (hourEnd - hourStart) * pxPerHour) return;

        const card = document.createElement('div');
        card.className = 'cb-avail-busy';
        card.style.top = `${Math.max(0, top)}px`;
        card.style.height = `${Math.min((hourEnd - hourStart) * pxPerHour - Math.max(0, top), height)}px`;
        const timeLabel = `${s.start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}–${s.end.toLocaleTimeString(
          'vi-VN',
          { hour: '2-digit', minute: '2-digit' }
        )}`;
        card.innerHTML = `
          <div class="t1">${escapeHtml(timeLabel)} • ${escapeHtml(String(s.status || ''))}</div>
          <div class="t2">${escapeHtml(s.customerName)} • ${escapeHtml(s.location || '-')}</div>
        `;
        dayCol.appendChild(card);
      });

      grid.appendChild(dayCol);
    });

    // Now line (nếu đang nằm trong tuần)
    const now = new Date();
    if (now >= weekStart && now <= weekEnd) {
      const viewStart = new Date(now);
      viewStart.setHours(hourStart, 0, 0, 0);
      const viewEnd = new Date(now);
      viewEnd.setHours(hourEnd, 0, 0, 0);
      if (now >= viewStart && now <= viewEnd) {
        const y = (((now.getHours() * 60 + now.getMinutes()) - hourStart * 60) / 60) * pxPerHour;
        const line = document.createElement('div');
        line.className = 'cb-avail-now';
        line.style.top = `${Math.max(0, y)}px`;
        cal.appendChild(line);
      }
    }

    cal.replaceChildren(header, grid);
  }

  // bind nav buttons once
  if (!window.__cbAvailState.bound && (prevBtn || nextBtn || todayBtn)) {
    window.__cbAvailState.bound = true;
    prevBtn?.addEventListener('click', () => {
      const a = window.__cbAvailState.anchor || new Date();
      window.__cbAvailState.anchor = new Date(a.getTime() - 7 * 86400000);
      renderWeek();
    });
    nextBtn?.addEventListener('click', () => {
      const a = window.__cbAvailState.anchor || new Date();
      window.__cbAvailState.anchor = new Date(a.getTime() + 7 * 86400000);
      renderWeek();
    });
    todayBtn?.addEventListener('click', () => {
      window.__cbAvailState.anchor = new Date();
      renderWeek();
    });
  }

  renderWeek();

  if (!busySlots.length) {
    rows.innerHTML = '<tr><td colspan="4" class="text-muted">Hiện chưa có khung giờ bận nào.</td></tr>';
    return;
  }

  busySlots.forEach((slot) => {
    const statusClass =
      slot.status === 'IN_PROGRESS'
        ? 'text-bg-danger'
        : slot.status === 'ACCEPTED'
          ? 'text-bg-warning'
          : 'text-bg-secondary';
    const tr = document.createElement('tr');
    tr.innerHTML = `
            <td>${escapeHtml(fmtDateTime(slot.start))}</td>
            <td>${escapeHtml(fmtDateTime(slot.end))}</td>
            <td><span class="badge ${statusClass}">${escapeHtml(slot.status)}</span></td>
            <td>${escapeHtml(slot.customerName)} (${escapeHtml(slot.location)})</td>`;
    rows.appendChild(tr);
  });
}

async function addAvailability(e) {
  e?.preventDefault?.();
  showAlert('Lịch rảnh đã chuyển sang chế độ tự động theo trạng thái online và booking.', 'info');
}

async function updateBookingStatus(bookingId, status) {
  await sendJson(`/api/companions/me/bookings/${bookingId}`, 'PATCH', { status });
  await loadBookings();
  await loadBookingWorkflow();
  await loadIncomeStats();
  showAlert(`Đã cập nhật trạng thái -> ${status}.`);
}

async function checkInBooking(bookingId) {
  try {
    await sendJson(`/api/bookings/me/${bookingId}/check-in`, 'PATCH', {});
    await loadBookings();
    await loadBookingWorkflow();
    showAlert('Đã check-in. Phiên đã bắt đầu.');
  } catch (err) {
    showAlert(err.message || 'Check-in thất bại', 'danger');
  }
}

async function checkOutBooking(bookingId) {
  try {
    await sendJson(`/api/bookings/me/${bookingId}/check-out`, 'PATCH', {});
    await loadBookings();
    await loadBookingWorkflow();
    await loadIncomeStats();
    showAlert('Đã check-out. Đơn đã hoàn tất.');
  } catch (err) {
    showAlert(err.message || 'Check-out thất bại', 'danger');
  }
}

async function sendSos(bookingId) {
  const noteInput = document.getElementById('sos-note-input');
  const note = (noteInput?.value || '').trim();
  if (!note) {
    showAlert('Vui lòng nhập nội dung SOS.', 'warning');
    return;
  }
  await sendJson(`/api/companions/me/bookings/${bookingId}/sos`, 'POST', {
    note,
  });
  const modalEl = document.getElementById('sos-modal');
  const modal = modalEl ? bootstrap.Modal.getInstance(modalEl) : null;
  modal?.hide();
  if (noteInput) noteInput.value = '';
  showAlert('Đã gửi SOS.', 'warning');
}

function ensureSosModal() {
  let modalEl = document.getElementById('sos-modal');
  if (modalEl) return modalEl;
  modalEl = document.createElement('div');
  modalEl.className = 'modal fade';
  modalEl.id = 'sos-modal';
  modalEl.tabIndex = -1;
  modalEl.innerHTML = `
        <div class="modal-dialog modal-dialog-centered">
            <div class="modal-content border-danger">
                <div class="modal-header bg-danger text-white">
                    <h5 class="modal-title"><i class="bi bi-exclamation-octagon-fill me-2"></i>Kích hoạt SOS</h5>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                </div>
                <div class="modal-body">
                    <div class="alert alert-warning py-2">
                        SOS sẽ gửi cảnh báo ngay cho khách hàng và Admin.
                    </div>
                    <label class="form-label fw-semibold" for="sos-note-input">Nội dung khẩn cấp</label>
                    <textarea id="sos-note-input" class="form-control" rows="3" placeholder="Mô tả nhanh tình huống hiện tại..." required></textarea>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" data-bs-dismiss="modal">Hủy</button>
                    <button class="btn btn-danger" id="confirm-sos-btn"><i class="bi bi-broadcast-pin me-1"></i>Gửi SOS ngay</button>
                </div>
            </div>
        </div>
    `;
  document.body.appendChild(modalEl);
  return modalEl;
}

function openSosModal(booking) {
  const bookingId = booking?.id || booking?._id;
  if (!bookingId) {
    showAlert('Không tìm thấy thông tin booking để gửi SOS.', 'danger');
    return;
  }
  const modalEl = ensureSosModal();
  const noteInput = modalEl.querySelector('#sos-note-input');
  if (noteInput) {
    const customer =
      booking?.customer?.fullName || booking?.customer?.username || 'Khách hàng';
    const bookingTime = fmtDateTime(booking?.bookingTime);
    const location = booking?.location || '-';
    noteInput.value = `SOS khẩn cấp. Khách hàng: ${customer}. Thời gian: ${bookingTime}. Địa điểm: ${location}.`;
  }
  const confirmBtn = modalEl.querySelector('#confirm-sos-btn');
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      try {
        await sendSos(bookingId);
      } catch (err) {
        showAlert(`Không thể gửi SOS: ${err.message}`, 'danger');
      }
    };
  }
  const modal = new bootstrap.Modal(modalEl);
  modal.show();
}

async function acceptBookingExtension(bookingId) {
  try {
    await sendJson(`/api/companions/me/bookings/${bookingId}/extension/accept`, 'POST', {});
    await loadBookings();
    await loadBookingWorkflow();
    await loadIncomeStats();
    showAlert(`Đã chấp nhận gia hạn cho booking #${bookingId}.`);
  } catch (err) {
    showAlert(err.message || 'Không thể chấp nhận gia hạn', 'danger');
  }
}

async function rejectBookingExtension(bookingId) {
  try {
    await sendJson(`/api/companions/me/bookings/${bookingId}/extension/reject`, 'POST', {});
    await loadBookings();
    await loadBookingWorkflow();
    showAlert(`Đã từ chối yêu cầu gia hạn cho booking #${bookingId}.`);
  } catch (err) {
    showAlert(err.message || 'Không thể từ chối', 'danger');
  }
}

async function loadBookings() {
  const rows = document.getElementById('booking-body');
  const bookings = await getJson('/api/companions/me/bookings');
  rows.innerHTML = '';

  // Realtime: join room cho các booking đang active để thấy check-in/out từ khách theo thời gian thực.
  if (window.RealtimeStomp && typeof RealtimeStomp.subscribeBookingStatus === 'function') {
    try {
      await RealtimeStomp.ensureLibs();
      await RealtimeStomp.connect();
      const active = (Array.isArray(bookings) ? bookings : []).filter((b) => ['ACCEPTED', 'IN_PROGRESS'].includes(b.status));
      const seen = new Set(active.slice(0, 12).map((b) => String(b.id || b._id)));
      if (!window.__compBookingSubs) window.__compBookingSubs = new Map();
      for (const [bid, sub] of window.__compBookingSubs.entries()) {
        if (!seen.has(bid)) {
          try {
            sub?.unsubscribe?.();
          } catch (_) {}
          window.__compBookingSubs.delete(bid);
        }
      }
      for (const bid of seen) {
        if (window.__compBookingSubs.has(bid)) continue;
        const sub = await RealtimeStomp.subscribeBookingStatus(bid, async (evt) => {
          const e = evt || {};
          const isSelf =
            (e.event === 'checkin_requested' && e.requestedBy === 'COMPANION') ||
            (e.event === 'checkout_requested' && e.requestedBy === 'COMPANION');
          const map = {
            checkin_requested: isSelf ? 'Bạn đã gửi yêu cầu check-in' : 'Khách yêu cầu check-in',
            checkin_confirmed: 'Check-in đã được xác nhận',
            checkout_requested: isSelf ? 'Bạn đã gửi yêu cầu check-out' : 'Khách yêu cầu check-out',
            checkout_confirmed: 'Check-out đã được xác nhận',
            extension_requested: `Khách xin gia hạn +${Number(e.extraMinutes || 30)} phút`,
            extension_accepted: 'Bạn đã chấp nhận gia hạn',
            extension_rejected: 'Bạn đã từ chối gia hạn',
          };
          showAlert(map[e.event] || 'Cập nhật booking', 'info');
          await loadBookings();
          await loadBookingWorkflow();
          await loadIncomeStats();
        });
        window.__compBookingSubs.set(bid, sub);
      }
    } catch (e) {
      console.warn('Booking realtime không khả dụng', e);
    }
  }

  if (!bookings.length) {
    rows.innerHTML = '<tr><td colspan="7" class="text-muted">Chưa có booking.</td></tr>';
    return;
  }
  bookings.forEach((item) => {
    const tr = document.createElement('tr');
    const canProcess = item.status === 'PENDING';
    const canCheckIn = item.status === 'ACCEPTED';
    const canCheckOut = item.status === 'IN_PROGRESS';
    const canSos = item.status === 'ACCEPTED' || item.status === 'IN_PROGRESS';
    const hasPendingExt = item.pendingExtensionMinutes != null;
    const extLine = hasPendingExt
      ? `<div class="small text-warning mb-1">Khách xin gia hạn +${item.pendingExtensionMinutes} phút</div>`
      : '';

    const gross = item?.pricing?.grossAmount ?? item?.holdAmount ?? 0;
    const commission = item?.pricing?.commissionAmount ?? 0;
    const net = item?.pricing?.netAmount ?? 0;
    const payout = item?.pricing?.payout || null;
    const payoutLine = payout?.id
      ? `<div class="small text-success mt-1"><i class="bi bi-check-circle me-1"></i>Đã cộng ví ${escapeHtml(fmtDateTime(payout.createdAt))}</div>`
      : item.status === 'COMPLETED'
        ? `<div class="small text-muted mt-1"><i class="bi bi-hourglass-split me-1"></i>Chưa thấy giao dịch cộng ví</div>`
        : '';

    tr.innerHTML = `
            <td>${item.id}</td>
            <td>${escapeHtml(item.customer?.fullName || item.customer?.username || '')}</td>
            <td>${escapeHtml(fmtDateTime(item.bookingTime))}</td>
            <td>${item.duration} phút${extLine}</td>
            <td>
              <div class="fw-semibold">${escapeHtml(fmtMoneyVnd(gross))}</div>
              <div class="small text-muted">Phí: ${escapeHtml(fmtMoneyVnd(commission))} • Nhận: <span class="text-success fw-semibold">${escapeHtml(fmtMoneyVnd(net))}</span></div>
              ${payoutLine}
            </td>
            <td><span class="badge text-bg-secondary">${escapeHtml(item.status)}</span></td>
            <td class="text-end">
                ${
                  canProcess
                    ? `<button class="btn btn-sm btn-success me-2" data-action="accept">Nhận</button>
                <button class="btn btn-sm btn-danger" data-action="reject">Từ chối</button>`
                    : ''
                }
                ${
                  hasPendingExt
                    ? `<button class="btn btn-sm btn-success me-1" data-action="ext-accept">Chấp nhận gia hạn</button>
                <button class="btn btn-sm btn-outline-secondary me-2" data-action="ext-reject">Từ chối gia hạn</button>`
                    : ''
                }
                ${canCheckIn ? `<button class="btn btn-sm btn-outline-primary me-2" data-action="checkin">Check-in</button>` : ''}
                ${canCheckOut ? `<button class="btn btn-sm btn-outline-success me-2" data-action="checkout">Check-out</button>` : ''}
                ${canSos ? `<button class="btn btn-sm btn-danger" data-action="sos"><i class="bi bi-exclamation-octagon me-1"></i>SOS</button>` : ''}
            </td>`;
    if (canProcess) {
      tr.querySelector('[data-action="accept"]').addEventListener('click', () =>
        updateBookingStatus(item.id, 'ACCEPTED')
      );
      tr.querySelector('[data-action="reject"]').addEventListener('click', () =>
        updateBookingStatus(item.id, 'REJECTED')
      );
    }
    if (hasPendingExt) {
      tr.querySelector('[data-action="ext-accept"]')?.addEventListener('click', () => acceptBookingExtension(item.id));
      tr.querySelector('[data-action="ext-reject"]')?.addEventListener('click', () => rejectBookingExtension(item.id));
    }
    if (canCheckIn) {
      tr.querySelector('[data-action="checkin"]').addEventListener('click', () => checkInBooking(item.id));
    }
    if (canCheckOut) {
      tr.querySelector('[data-action="checkout"]').addEventListener('click', () => checkOutBooking(item.id));
    }
    tr.querySelector('[data-action="sos"]')?.addEventListener('click', () => openSosModal(item));
    rows.appendChild(tr);
  });
}

function setTextIfEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

async function loadBookingWorkflow() {
  const wf = await getJson('/api/companions/me/bookings/workflow');
  setTextIfEl('wf-pending', String((wf.pending || []).length));
  setTextIfEl('wf-upcoming', String((wf.upcoming || []).length));
  setTextIfEl('wf-running', String((wf.running || []).length));
  setTextIfEl('wf-done', String((wf.done || []).length));
}

async function answerConsultation(id, answer) {
  await sendJson(`/api/companions/me/consultations/${id}/answer`, 'PATCH', { answer });
  await loadConsultations();
  showAlert(`Đã trả lời tư vấn #${id}.`);
}

async function loadConsultations() {
  const rows = document.getElementById('consultation-body');
  const list = await getJson('/api/companions/me/consultations');
  rows.innerHTML = '';
  if (!list.length) {
    rows.innerHTML = '<tr><td colspan="5" class="text-muted">Chưa có câu hỏi tư vấn.</td></tr>';
    return;
  }
  list.forEach((item) => {
    const tr = document.createElement('tr');
    const canAnswer = item.status === 'PENDING';
    tr.innerHTML = `
            <td>${item.id}</td>
            <td>${escapeHtml(item.customer?.fullName || item.customer?.username || '')}</td>
            <td>${escapeHtml(item.question || '')}</td>
            <td>
                ${
                  canAnswer
                    ? `<div class="input-group input-group-sm">
                        <input class="form-control" placeholder="Nhập câu trả lời">
                        <button class="btn btn-primary">Gửi</button>
                    </div>`
                    : `<span>${escapeHtml(item.answer || '')}</span>`
                }
            </td>
            <td><span class="badge text-bg-secondary">${escapeHtml(item.status)}</span></td>`;
    if (canAnswer) {
      const input = tr.querySelector('input');
      tr.querySelector('button').addEventListener('click', async () => {
        const answer = input.value.trim();
        if (!answer) {
          showAlert('Vui lòng nhập câu trả lời.', 'warning');
          return;
        }
        await answerConsultation(item.id, answer);
      });
    }
    rows.appendChild(tr);
  });
}

async function loadIncomeStats() {
  if (!document.getElementById('stat-income')) {
    return;
  }
  const stats = await getJson('/api/companions/me/income-stats');
  setTextIfEl('stat-income', Number(stats.totalIncome || 0).toLocaleString('vi-VN'));
  setTextIfEl('stat-available', Number(stats.availableBalance || 0).toLocaleString('vi-VN'));
  setTextIfEl('stat-hold', Number(stats.holdAmount || 0).toLocaleString('vi-VN'));
  setTextIfEl('stat-accepted', String(stats.acceptedBookings ?? 0));
  setTextIfEl('stat-completed', String(stats.completedBookings ?? 0));
}

async function loadWalletTransactions() {
  const body = document.getElementById('wallet-tx-body');
  if (!body) return;
  const data = await getJson('/api/wallet/me');
  const txs = Array.isArray(data?.transactions) ? data.transactions : [];
  body.innerHTML = '';
  if (!txs.length) {
    body.innerHTML = '<tr><td colspan="5" class="text-muted">Chưa có giao dịch.</td></tr>';
    return;
  }
  txs.forEach((t) => {
    const tr = document.createElement('tr');
    const amt = Number(t.amount || 0);
    const cls = amt < 0 ? 'text-danger' : 'text-success';
    tr.innerHTML = `
      <td>${escapeHtml(fmtDateTime(t.createdAt))}</td>
      <td>${escapeHtml(t.type || '-')}</td>
      <td>${escapeHtml(t.provider || '-')}</td>
      <td class="text-muted small">${escapeHtml(t.description || '-')}</td>
      <td class="text-end fw-semibold ${cls}">${amt.toLocaleString('vi-VN')} VND</td>
    `;
    body.appendChild(tr);
  });
}

async function loadServicePrices() {
  const rows = document.getElementById('service-price-body');
  const raw = await getJson('/api/companions/me/service-prices');
  const data = Array.isArray(raw) ? raw : raw.items ?? [];
  rows.innerHTML = '';
  if (!data.length) {
    rows.innerHTML = '<tr><td colspan="4" class="text-muted">Chưa có bảng giá.</td></tr>';
    return;
  }
  data.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
            <td>${escapeHtml(item.serviceName || '')}</td>
            <td>${Number(item.pricePerHour || 0).toLocaleString('vi-VN')}</td>
            <td>${escapeHtml(item.description || '')}</td>
            <td class="text-end"><button class="btn btn-sm btn-outline-danger">Xóa</button></td>`;
    tr.querySelector('button').addEventListener('click', async () => {
      await fetch(`/api/companions/me/service-prices/${item.id || item._id}`, { method: 'DELETE' });
      await loadServicePrices();
      showAlert('Đã xóa bảng giá.');
    });
    rows.appendChild(tr);
  });
}

async function addServicePrice(e) {
  e.preventDefault();
  await sendJson('/api/companions/me/service-prices', 'POST', {
    serviceName: document.getElementById('service-name').value.trim(),
    pricePerHour: document.getElementById('service-price').value,
    description: document.getElementById('service-description').value.trim(),
  });
  e.target.reset();
  await loadServicePrices();
  showAlert('Đã thêm bảng giá dịch vụ.');
}

async function loadWithdrawals() {
  const rows = document.getElementById('withdrawal-body');
  const data = await getJson('/api/companions/me/withdrawals');
  rows.innerHTML = '';
  if (!data.length) {
    rows.innerHTML = '<tr><td colspan="6" class="text-muted">Chưa có lệnh rút tiền.</td></tr>';
    return;
  }
  data.forEach((item) => {
    const tr = document.createElement('tr');
    const comm = item.commissionAmount != null ? Number(item.commissionAmount) : null;
    const net = item.netAmount != null ? Number(item.netAmount) : null;
    const commStr = comm != null && !Number.isNaN(comm) ? comm.toLocaleString('vi-VN') : '—';
    const netStr = net != null && !Number.isNaN(net) ? net.toLocaleString('vi-VN') : '—';
    tr.innerHTML = `
            <td>${escapeHtml(fmtDateTime(item.createdAt))}</td>
            <td>${Number(item.amount || 0).toLocaleString('vi-VN')}</td>
            <td class="text-warning">${commStr}</td>
            <td class="text-success fw-semibold">${netStr}</td>
            <td>${escapeHtml(item.bankName || '')}</td>
            <td><span class="badge text-bg-secondary">${escapeHtml(item.status || '')}</span></td>`;
    rows.appendChild(tr);
  });
}

async function createWithdrawal(e) {
  e.preventDefault();
  await sendJson('/api/companions/me/withdrawals', 'POST', {
    amount: document.getElementById('withdraw-amount').value,
  });
  e.target.reset();
  await loadWithdrawals();
  await loadIncomeStats();
  showAlert('Đã tạo lệnh rút tiền.');
}

async function loadBankAccount() {
  const data = await getJson('/api/companions/me/bank-account');
  const bankName = document.getElementById('bank-name');
  const bankAccountNumber = document.getElementById('bank-account-number');
  const accountHolderName = document.getElementById('account-holder-name');
  if (bankName) bankName.value = data.bankName || '';
  if (bankAccountNumber) bankAccountNumber.value = data.bankAccountNumber || '';
  if (accountHolderName) accountHolderName.value = data.accountHolderName || '';

  // UX: đã lưu rồi thì thu gọn form, chỉ hiện tóm tắt + nút Sửa.
  try {
    const bn = String(data.bankName || '').trim();
    const acc = String(data.bankAccountNumber || '').trim();
    const holder = String(data.accountHolderName || '').trim();
    const summary = document.getElementById('comp-bank-summary');
    const summaryText = document.getElementById('comp-bank-summary-text');
    const fields = document.getElementById('comp-bank-fields');
    if (!summary || !summaryText || !fields) return;
    const hasAll = bn && acc && holder;
    if (hasAll) {
      summaryText.textContent = `Tên ngân hàng: ${bn}\nSố tài khoản: ${acc}\nTên chủ tài khoản: ${holder}`;
      summary.classList.remove('d-none');
      fields.classList.add('d-none');
    } else {
      summary.classList.add('d-none');
      fields.classList.remove('d-none');
    }
  } catch (_) {}
}

async function saveBankAccount(e) {
  e.preventDefault();
  await sendJson('/api/companions/me/bank-account', 'PUT', {
    bankName: document.getElementById('bank-name').value.trim(),
    bankAccountNumber: document.getElementById('bank-account-number').value.trim(),
    accountHolderName: document.getElementById('account-holder-name').value.trim(),
  });
  showAlert('Đã lưu tài khoản ngân hàng nhận tiền.');
  await loadBankAccount();
}

async function bootstrap() {
  let auth;
  try {
    auth = await getJson('/api/auth/me');
  } catch {
    window.location.href = '../user/login.html';
    return;
  }
  if (!auth?.authenticated) {
    window.location.href = '../user/login.html';
    return;
  }
  if (auth.role !== 'COMPANION') {
    window.location.href = '../user/index.html';
    return;
  }

  try {
    const authUserEl = document.getElementById('auth-user');
    if (authUserEl) {
      const myName = auth.user?.fullName || auth.username || auth.user?.username || '';
      authUserEl.textContent = myName ? `Xin chào, ${myName}` : `Xin chào, ${auth.username || ''}`;
    }

    // Tab "Cài đặt tài khoản" (companion/profile.html): điền đủ thông tin + cho phép cập nhật.
    const accountFullNameEl = document.getElementById('account-fullname');
    const accountContactEl = document.getElementById('account-contact');
    if (accountFullNameEl) {
      accountFullNameEl.value = auth.user?.fullName || '';
    }
    if (accountContactEl) {
      const email = auth.user?.email || '';
      const phone = auth.user?.phoneNumber || '';
      accountContactEl.value = [email, phone].filter(Boolean).join(' • ') || email || phone || '';
    }
    const accountForm = document.getElementById('account-form');
    if (accountForm) {
      accountForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const fullName = (document.getElementById('account-fullname')?.value || '').trim();
        const currentPassword = document.getElementById('current-password')?.value || '';
        const newPassword = document.getElementById('new-password')?.value || '';
        const confirmPassword = document.getElementById('confirm-password')?.value || '';

        try {
          // cập nhật tên hiển thị (không bắt buộc đổi mật khẩu)
          if (fullName && fullName !== (auth.user?.fullName || '')) {
            await getJson('/api/auth/me', {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ fullName }),
            });
            auth.user.fullName = fullName;
            if (authUserEl) authUserEl.textContent = `Xin chào, ${fullName}`;
          }

          // đổi mật khẩu nếu user nhập
          const wantsChange =
            (currentPassword && newPassword) || (currentPassword && confirmPassword) || (newPassword && confirmPassword);
          if (wantsChange) {
            if (!currentPassword || !newPassword) {
              throw new Error('Vui lòng nhập mật khẩu hiện tại và mật khẩu mới.');
            }
            if (newPassword.length < 6) {
              throw new Error('Mật khẩu mới phải từ 6 ký tự trở lên.');
            }
            if (newPassword !== confirmPassword) {
              throw new Error('Xác nhận mật khẩu không khớp.');
            }
            await getJson('/api/auth/change-password', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ currentPassword, newPassword }),
            });
            document.getElementById('current-password').value = '';
            document.getElementById('new-password').value = '';
            document.getElementById('confirm-password').value = '';
          }

          showAlert('Đã cập nhật tài khoản.');
        } catch (err) {
          showAlert(err.message || 'Không thể cập nhật tài khoản.', 'danger');
        }
      });
    }

    await pollCompanionRealtimeNotifications();
    if (auth.userId && window.RealtimeStomp) {
      try {
        await RealtimeStomp.ensureLibs();
        await RealtimeStomp.connect();
        await RealtimeStomp.subscribeNotifications(Number(auth.userId), (n) => {
          // Nếu admin khóa tài khoản trong lúc đang online → logout ngay.
          const title = String(n?.title || '').toLowerCase();
          const content = String(n?.content || '').toLowerCase();
          if (title.includes('tài khoản bị khóa') || content.includes('tài khoản của bạn đã bị khóa')) {
            try {
              localStorage.removeItem('token');
              localStorage.removeItem('role');
              localStorage.removeItem('userId');
            } finally {
              window.location.href = '../user/login.html';
            }
            return;
          }
          const id = String(n.id);
          if (!companionRealtimeNotifState.seenIds.has(id)) {
            companionRealtimeNotifState.seenIds.add(id);
            showCompanionNotificationToast(n);
          }
          pollCompanionRealtimeNotifications();
        });
        // Dự phòng: vẫn poll định kỳ để không phụ thuộc 100% vào socket (tránh miss event do mạng/proxy).
        if (!companionRealtimeNotifState.timer) {
          companionRealtimeNotifState.timer = setInterval(pollCompanionRealtimeNotifications, 5000);
        }
      } catch (e) {
        console.warn('WebSocket thông báo không khả dụng, dùng polling', e);
        if (!companionRealtimeNotifState.timer) {
          companionRealtimeNotifState.timer = setInterval(pollCompanionRealtimeNotifications, 4000);
        }
      }
    } else if (!companionRealtimeNotifState.timer) {
      companionRealtimeNotifState.timer = setInterval(pollCompanionRealtimeNotifications, 4000);
    }
    const page = document.body.dataset.page || 'companion-dashboard';
    if (page === 'companion-dashboard') {
      document.getElementById('companion-chart-range')?.addEventListener('change', async (e) => {
        companionChartState.range = e.target.value;
        await loadCompanionDashboardCharts();
      });
    }

    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', async (e) => {
        try {
          await saveProfile(e);
        } catch (err) {
          showAlert(`Không thể cập nhật hồ sơ: ${err.message}`, 'danger');
        }
      });
    }

    const availabilityForm = document.getElementById('availability-form');
    if (availabilityForm) {
      availabilityForm.addEventListener('submit', async (e) => {
        try {
          await addAvailability(e);
        } catch (err) {
          showAlert(`Không thể thêm lịch rảnh: ${err.message}`, 'danger');
        }
      });
    }

    const onlineToggle = document.getElementById('online-toggle');
    if (onlineToggle) {
      onlineToggle.addEventListener('change', async () => {
        try {
          await updateOnlineStatus();
          await loadOnlineState();
        } catch (err) {
          showAlert(`Không thể cập nhật online: ${err.message}`, 'danger');
        }
      });
    }

    const servicePriceForm = document.getElementById('service-price-form');
    if (servicePriceForm) {
      servicePriceForm.addEventListener('submit', async (e) => {
        try {
          await addServicePrice(e);
        } catch (err) {
          showAlert(`Không thể thêm bảng giá: ${err.message}`, 'danger');
        }
      });
    }

    const withdrawForm = document.getElementById('withdraw-form');
    if (withdrawForm) {
      withdrawForm.addEventListener('submit', async (e) => {
        try {
          await createWithdrawal(e);
        } catch (err) {
          showAlert(`Không thể rút tiền: ${err.message}`, 'danger');
        }
      });
    }
    const bankAccountForm = document.getElementById('bank-account-form');
    if (bankAccountForm) {
      bankAccountForm.addEventListener('submit', async (e) => {
        try {
          await saveBankAccount(e);
        } catch (err) {
          showAlert(`Không thể lưu tài khoản ngân hàng: ${err.message}`, 'danger');
        }
      });
    }

    // Nút "Sửa" cho phần tài khoản ngân hàng (finance page).
    document.getElementById('comp-bank-edit-btn')?.addEventListener('click', () => {
      const summary = document.getElementById('comp-bank-summary');
      const fields = document.getElementById('comp-bank-fields');
      if (summary) summary.classList.add('d-none');
      if (fields) fields.classList.remove('d-none');
      document.getElementById('bank-name')?.focus?.();
    });

    const tasks = [];
    if (page === 'companion-dashboard') {
      tasks.push(loadBookingWorkflow(), loadIncomeStats(), loadCompanionDashboardCharts());
    }
    if (page === 'companion-profile') {
      initCompanionProfileUploads();
      tasks.push(loadProfile());
    }
    if (onlineToggle) {
      tasks.push(loadOnlineState());
    }
    if (page === 'companion-operations') {
      tasks.push(loadAvailabilities(), loadServicePrices());
    }
    if (page === 'companion-bookings') {
      tasks.push(loadBookings(), loadBookingWorkflow(), loadConsultations());
    }
    if (page === 'companion-finance') {
      tasks.push(loadIncomeStats(), loadWithdrawals(), loadBankAccount(), loadWalletTransactions());
    }
    if (page === 'companion-notifications') {
      tasks.push(loadCompanionNotifications());
    }
    if (page === 'companion-chat') {
      tasks.push(initCompanionChatPage());
    }
    const results = await Promise.allSettled(tasks);
    results.forEach((r, i) => {
      if (r.status === 'rejected') {
        console.warn(`[companion] Tải trang thất bại (task #${i}):`, r.reason);
      }
    });
  } catch (err) {
    console.error('[companion] bootstrap:', err);
  }
}

function notifIcon(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('booking') || t.includes('đặt lịch') || t.includes('lịch hẹn'))
    return { icon: 'bi-calendar-event-fill', bg: 'linear-gradient(135deg, #3b82f6, #6366f1)' };
  if (t.includes('thanh toán') || t.includes('tiền') || t.includes('rút'))
    return { icon: 'bi-wallet2', bg: 'linear-gradient(135deg, #10b981, #059669)' };
  if (t.includes('đánh giá') || t.includes('review'))
    return { icon: 'bi-star-fill', bg: 'linear-gradient(135deg, #f59e0b, #f97316)' };
  if (t.includes('báo cáo') || t.includes('sos') || t.includes('cảnh cáo'))
    return { icon: 'bi-exclamation-triangle-fill', bg: 'linear-gradient(135deg, #ef4444, #dc2626)' };
  if (t.includes('duyệt') || t.includes('companion') || t.includes('hồ sơ'))
    return { icon: 'bi-person-check-fill', bg: 'linear-gradient(135deg, #8b5cf6, #a78bfa)' };
  return { icon: 'bi-bell-fill', bg: 'linear-gradient(135deg, #64748b, #94a3b8)' };
}

const companionRealtimeNotifState = {
  initialized: false,
  seenIds: new Set(),
  timer: null,
};

function getCompanionToastContainer() {
  let box = document.getElementById('companion-realtime-toast-container');
  if (box) return box;
  box = document.createElement('div');
  box.id = 'companion-realtime-toast-container';
  box.style.cssText =
    'position:fixed;top:16px;right:16px;z-index:1080;display:flex;flex-direction:column;gap:8px;max-width:380px;';
  document.body.appendChild(box);
  return box;
}

function showCompanionNotificationToast(notification) {
  const box = getCompanionToastContainer();
  const item = document.createElement('div');
  item.className = 'shadow rounded-3 border bg-white p-3';
  item.innerHTML = `
        <div class="fw-semibold mb-1"><i class="bi bi-bell-fill text-primary me-2"></i>${escapeHtml(notification.title || 'Thông báo mới')}</div>
        <div class="small text-muted">${escapeHtml(notification.content || '')}</div>
    `;
  box.appendChild(item);
  setTimeout(() => item.remove(), 4500);
}

function processRealtimeCompanionNotifications(list) {
  const sorted = [...(Array.isArray(list) ? list : [])].sort(
    (a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
  );
  if (!companionRealtimeNotifState.initialized) {
    sorted.forEach((n) => companionRealtimeNotifState.seenIds.add(String(n.id)));
    companionRealtimeNotifState.initialized = true;
    return;
  }
  sorted.forEach((n) => {
    const id = String(n.id);
    if (!companionRealtimeNotifState.seenIds.has(id)) {
      companionRealtimeNotifState.seenIds.add(id);
      showCompanionNotificationToast(n);
    }
  });
}

async function pollCompanionRealtimeNotifications() {
  try {
    const list = await getJson('/api/companion/notifications/me');
    processRealtimeCompanionNotifications(list);
  } catch (_) {
    // keep silent for transient issues
  }
}

async function loadCompanionNotifications() {
  const listBox = document.getElementById('notification-list');
  const countBadge = document.getElementById('unread-count');
  const markAllBtn = document.getElementById('mark-all-read-btn');
  if (!listBox) return;

  async function render() {
    const list = await getJson('/api/companion/notifications/me');
    const unread = list.filter((n) => !n.isRead).length;
    if (countBadge) countBadge.textContent = `${unread} chưa đọc`;

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
        const timeStr = fmtDateTime(n.createdAt);
        return `
            <div class="notif-item d-flex gap-3 align-items-start ${n.isRead ? '' : 'unread'}" data-id="${n.id}" data-read="${n.isRead}">
                <div class="notif-icon text-white" style="background: ${ic.bg};">
                    <i class="bi ${ic.icon}"></i>
                </div>
                <div class="flex-grow-1">
                    <div class="d-flex justify-content-between align-items-start">
                        <div class="notif-title">${escapeHtml(n.title)}</div>
                        ${!n.isRead ? '<span class="notif-dot ms-2 mt-2"></span>' : ''}
                    </div>
                    <div class="text-muted small mt-1">${escapeHtml(n.content)}</div>
                    <div class="notif-time mt-1"><i class="bi bi-clock me-1"></i>${timeStr}</div>
                </div>
            </div>`;
      })
      .join('');

    listBox.querySelectorAll('.notif-item[data-read="false"]').forEach((item) => {
      item.addEventListener('click', async () => {
        const id = item.getAttribute('data-id');
        await fetch(`/api/companion/notifications/${id}/read`, { method: 'PATCH' });
        item.classList.remove('unread');
        item.setAttribute('data-read', 'true');
        const dot = item.querySelector('.notif-dot');
        if (dot) dot.remove();
        const refreshed = await getJson('/api/companion/notifications/me');
        const u = refreshed.filter((nn) => !nn.isRead).length;
        if (countBadge) countBadge.textContent = `${u} chưa đọc`;
      });
    });
  }

  if (markAllBtn) {
    markAllBtn.addEventListener('click', async () => {
      await fetch('/api/companion/notifications/read-all', { method: 'PATCH' });
      await render();
    });
  }

  await render();
}

async function initCompanionChatPage() {
  const bookingIdText = document.getElementById('chat-booking-id-text');
  const threadTitle = document.getElementById('chat-thread-title');
  const bookingSelect = document.getElementById('chat-booking-select');
  let currentBookingId = new URLSearchParams(window.location.search).get('bookingId') || '';
  let threads = [];
  let chatStompSub = null;
  let chatPollTimer = null;
  const allowedChatStatuses = new Set(['ACCEPTED', 'IN_PROGRESS']);
  let auth = null;

  try {
    auth = await getJson('/api/auth/me');
  } catch (_) {
    auth = null;
  }
  const myNameEl = document.getElementById('auth-user');
  if (myNameEl && auth) {
    const myName = auth.user?.fullName || auth.username || auth.user?.username || '';
    myNameEl.textContent = myName ? `Xin chào, ${myName}` : 'Xin chào';
  }

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
      chatStompSub = await RealtimeStomp.subscribeChat(String(currentBookingId), () => {
        loadMessages();
      });
    } catch (e) {
      console.warn('WebSocket chat không khả dụng', e);
    }
  }

  function updateThreadHeader() {
    if (!bookingIdText || !threadTitle) return;
    if (!currentBookingId) {
      bookingIdText.textContent = '-';
      threadTitle.textContent = 'Chưa chọn cuộc trò chuyện';
      return;
    }
    const active = threads.find((t) => t.bookingId === currentBookingId);
    bookingIdText.textContent = String(currentBookingId);
    threadTitle.textContent = active ? `Khách hàng: ${active.partnerName}` : 'Cuộc trò chuyện';
  }

  function renderBookingSelect() {
    if (!bookingSelect) return;
    const items = Array.isArray(threads) ? threads : [];
    if (!items.length) {
      bookingSelect.innerHTML = `<option value="">Không có cuộc chat</option>`;
      bookingSelect.value = '';
      bookingSelect.disabled = true;
      return;
    }
    bookingSelect.disabled = false;
    bookingSelect.innerHTML = items
      .map((t) => {
        const label = `${t.partnerName || 'Khách'} • ${t.status || '-'} • ${fmtDateTime(t.bookingTime) || ''}`.trim();
        return `<option value="${escapeHtml(t.bookingId)}">${escapeHtml(label)}</option>`;
      })
      .join('');
    bookingSelect.value = items.some((t) => t.bookingId === String(currentBookingId))
      ? String(currentBookingId)
      : items[0].bookingId;
  }

  async function switchBooking(nextId) {
    const next = String(nextId || '').trim();
    if (!next || next === String(currentBookingId)) return;
    currentBookingId = next;
    updateThreadHeader();
    renderBookingSelect();
    syncChatComposerState();
    await loadMessages();
    await resubscribeChatSocket();
  }

  async function loadChatThreads() {
    const list = await getJson('/api/companions/me/bookings');
    threads = (Array.isArray(list) ? list : [])
      .filter((b) => Boolean(b?.id || b?._id))
      .map((b) => ({
        bookingId: String(b.id || b._id),
        partnerName: b.customer?.fullName || b.customer?.username || `User #${b.customer?.id || '-'}`,
        status: b.status || '-',
        bookingTime: b.bookingTime,
      }))
      .filter((t) => allowedChatStatuses.has(t.status))
      .sort((a, b) => new Date(b.bookingTime || 0).getTime() - new Date(a.bookingTime || 0).getTime());
  }

  function resolveBookingForChat() {
    const existing = String(currentBookingId || '').trim();
    if (existing && threads.some((t) => t.bookingId === existing)) {
      return existing;
    }
    if (!threads.length) return '';

    const now = Date.now();
    const parsed = threads.map((t) => {
      const ts = t.bookingTime ? new Date(t.bookingTime).getTime() : NaN;
      return { ...t, _ts: Number.isFinite(ts) ? ts : null };
    });

    const running = parsed.find((t) => t.status === 'IN_PROGRESS');
    if (running) return running.bookingId;

    const upcoming = parsed
      .filter((t) => t.status === 'ACCEPTED' && t._ts != null && t._ts >= now)
      .sort((a, b) => a._ts - b._ts)[0];
    if (upcoming) return upcoming.bookingId;

    const recentPast = parsed
      .filter((t) => t.status === 'ACCEPTED' && t._ts != null)
      .sort((a, b) => b._ts - a._ts)[0];
    return recentPast?.bookingId || parsed[0].bookingId;
  }

  function renderThreadList() {
    // danh sách đã bị loại bỏ khỏi UI
  }

  async function loadMessages() {
    const box = document.getElementById('chat-list');
    if (!box) return;
    if (!currentBookingId) {
      box.innerHTML = '<div class="text-muted">Chưa có cuộc trò chuyện để hiển thị.</div>';
      return;
    }
    let list = [];
    try {
      list = await getJson(`/api/chat/${currentBookingId}/messages`);
    } catch (err) {
      box.innerHTML = `<div class="text-danger">Không thể tải tin nhắn: ${escapeHtml(err.message || 'Lỗi không xác định')}</div>`;
      return;
    }
    box.innerHTML = list.length
      ? list
          .map((m) => {
            const senderId = String(m.sender?.id || m.senderId || '');
            const isMe = senderId && auth?.userId && String(senderId) === String(auth.userId);
            const name = m.sender?.fullName || m.sender?.username || (isMe ? 'Bạn' : 'Đối phương');
            const time = fmtDateTime(m.createdAt);
            const bubbleClass = isMe ? 'cb-bubble cb-me' : 'cb-bubble cb-them';
            const rowClass = isMe ? 'd-flex justify-content-end' : 'd-flex justify-content-start';
            return `
              <div class="${rowClass} mb-2">
                <div class="${bubbleClass}">
                  <div class="cb-bubble-text">${escapeHtml(m.content || '')}</div>
                  <div class="cb-bubble-meta">${escapeHtml(name)} • ${escapeHtml(time)}</div>
                </div>
              </div>
            `;
          })
          .join('')
      : '<div class="text-muted">Chưa có tin nhắn.</div>';
    box.scrollTop = box.scrollHeight;
  }

  function syncChatComposerState() {
    const input = document.getElementById('chat-content');
    const form = document.getElementById('chat-form');
    if (!input || !form) return;
    const t = threads.find((x) => x.bookingId === String(currentBookingId));
    const status = t?.status || '';
    const enabled = Boolean(currentBookingId) && allowedChatStatuses.has(status);
    input.disabled = !enabled;
    form.querySelector('button[type="submit"]')?.toggleAttribute?.('disabled', !enabled);
    input.placeholder = !currentBookingId
      ? 'Chọn 1 cuộc trò chuyện để nhắn...'
      : enabled
        ? 'Nhập tin nhắn...'
        : `Chat chỉ mở khi đã nhận đơn (ACCEPTED/IN_PROGRESS). Trạng thái hiện tại: ${status || '-'}`;
  }

  document.getElementById('chat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentBookingId) {
      showAlert('Không tìm thấy booking phù hợp để chat.', 'warning');
      return;
    }
    const t = threads.find((x) => x.bookingId === String(currentBookingId));
    if (!allowedChatStatuses.has(t?.status)) {
      showAlert(`Chat đang bị khóa do trạng thái: ${t?.status || '-'}`, 'warning');
      syncChatComposerState();
      return;
    }
    const input = document.getElementById('chat-content');
    const content = (input?.value || '').trim();
    if (!content) return;
    try {
      // Ưu tiên socket realtime; fallback HTTP nếu socket lỗi/không khả dụng.
      let sentOk = false;
      if (window.RealtimeStomp?.sendChatMessage) {
        try {
          const ack = await RealtimeStomp.sendChatMessage(String(currentBookingId), content);
          sentOk = Boolean(ack?.ok);
        } catch (err) {
          console.warn('send_message failed, fallback HTTP', err);
        }
      }
      if (!sentOk) {
        await getJson(`/api/chat/${currentBookingId}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
      }
      if (input) input.value = '';
      await loadMessages();
    } catch (err) {
      showAlert(`Gửi tin nhắn thất bại: ${err.message}`, 'danger');
    }
  });

  document.getElementById('call-btn')?.addEventListener('click', async () => {
    if (!currentBookingId) {
      showAlert('Vui lòng chọn cuộc trò chuyện trước.', 'warning');
      return;
    }
    const box = document.getElementById('call-info');
    if (!box) return;
    try {
      const info = await getJson(`/api/chat/${currentBookingId}/call`);
      const contactPhone = info.contactPhone || info.customerPhone || '-';
      box.innerHTML = `<div class="alert alert-success mb-0">VoIP room: <strong>${escapeHtml(info.roomId)}</strong> | token: ${escapeHtml(info.token)}<br><strong>SĐT liên hệ:</strong> ${escapeHtml(contactPhone)}</div>`;
    } catch (err) {
      box.innerHTML = `<div class="alert alert-danger mb-0">${escapeHtml(err.message || 'Không thể lấy thông tin call')}</div>`;
    }
  });

  await loadChatThreads();
  currentBookingId = resolveBookingForChat();
  updateThreadHeader();
  renderBookingSelect();
  await loadMessages();
  syncChatComposerState();
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

  bookingSelect?.addEventListener('change', async () => {
    await switchBooking(bookingSelect.value);
  });
}

document.getElementById('logout-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  const token = localStorage.getItem('token');
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
  } finally {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    localStorage.removeItem('userId');
    window.location.href = '../user/index.html';
  }
});

bootstrap();
