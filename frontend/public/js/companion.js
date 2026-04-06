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
  const box = document.getElementById('alert-box');
  box.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
        ${escapeHtml(message)}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    </div>`;
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
  albumFiles: [],
  retainedIntroUrls: [],
  identityPreviewUrl: null,
  portraitPreviewUrl: null,
  albumPreviewUrls: [],
  serverIdentityUrl: '',
  serverPortraitUrl: '',
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

function resetCompanionProfileUploadState() {
  const st = companionProfileUploadState;
  revokeBlobUrl(st.identityPreviewUrl);
  revokeBlobUrl(st.portraitPreviewUrl);
  st.albumPreviewUrls.forEach((u) => revokeBlobUrl(u));
  st.identityFile = null;
  st.portraitFile = null;
  st.albumFiles = [];
  st.retainedIntroUrls = [];
  st.identityPreviewUrl = null;
  st.portraitPreviewUrl = null;
  st.albumPreviewUrls = [];
  st.serverIdentityUrl = '';
  st.serverPortraitUrl = '';
  ['identity-image-file', 'portrait-image-file', 'intro-media-files'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderIdentityThumbPreview();
  renderPortraitThumbPreview();
  renderIntroAlbumPreview();
}

function applyProfileMediaFromServer(profile) {
  const st = companionProfileUploadState;
  st.serverIdentityUrl = profile.identityImageUrl || '';
  st.serverPortraitUrl = profile.portraitImageUrl || '';
  st.retainedIntroUrls = splitIntroMediaUrlString(profile.introMediaUrls);
  renderIdentityThumbPreview();
  renderPortraitThumbPreview();
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
  const albumInput = document.getElementById('intro-media-files');
  if (!idInput || !portraitInput || !albumInput) return;
  companionProfileUploadInited = true;

  const idZone = document.getElementById('identity-image-dropzone');
  const portraitZone = document.getElementById('portrait-image-dropzone');
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
    document.getElementById('online-toggle').checked = !!(profile.onlineStatus ?? profile.online);
    const statusEl = document.getElementById('companion-status');
    if (statusEl) {
      statusEl.className = `badge ${statusBadgeClass(profile.status)}`;
      statusEl.textContent = profile.status || 'N/A';
    }
    revokeBlobUrl(companionProfileUploadState.identityPreviewUrl);
    revokeBlobUrl(companionProfileUploadState.portraitPreviewUrl);
    companionProfileUploadState.albumPreviewUrls.forEach((u) => revokeBlobUrl(u));
    companionProfileUploadState.identityFile = null;
    companionProfileUploadState.portraitFile = null;
    companionProfileUploadState.albumFiles = [];
    companionProfileUploadState.identityPreviewUrl = null;
    companionProfileUploadState.portraitPreviewUrl = null;
    companionProfileUploadState.albumPreviewUrls = [];
    const idIn = document.getElementById('identity-image-file');
    const prIn = document.getElementById('portrait-image-file');
    const alIn = document.getElementById('intro-media-files');
    if (idIn) idIn.value = '';
    if (prIn) prIn.value = '';
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
  const payload = {
    bio: document.getElementById('bio').value.trim(),
    hobbies: document.getElementById('hobbies').value.trim(),
    appearance: document.getElementById('appearance').value.trim(),
    availability: document.getElementById('availability-text').value.trim(),
    serviceType: document.getElementById('service-type').value.trim(),
    area: document.getElementById('area').value.trim(),
    rentalVenues: (document.getElementById('rental-venues')?.value || '').trim(),
    onlineStatus: String(document.getElementById('online-toggle').checked),
  };
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
      if (c.introMediaUrls != null) {
        st.retainedIntroUrls = splitIntroMediaUrlString(c.introMediaUrls);
      }
    }

    revokeBlobUrl(st.identityPreviewUrl);
    revokeBlobUrl(st.portraitPreviewUrl);
    st.albumPreviewUrls.forEach((u) => revokeBlobUrl(u));
    st.identityFile = null;
    st.portraitFile = null;
    st.albumFiles = [];
    st.identityPreviewUrl = null;
    st.portraitPreviewUrl = null;
    st.albumPreviewUrls = [];
    const idIn = document.getElementById('identity-image-file');
    const prIn = document.getElementById('portrait-image-file');
    const alIn = document.getElementById('intro-media-files');
    if (idIn) idIn.value = '';
    if (prIn) prIn.value = '';
    if (alIn) alIn.value = '';
    renderIdentityThumbPreview();
    renderPortraitThumbPreview();
    renderIntroAlbumPreview();

    showAlert('Đã cập nhật hồ sơ companion.');
    await loadProfile();
  } catch (err) {
    showAlert(`Không thể lưu hồ sơ: ${err.message || err}`, 'danger');
  }
}

async function updateOnlineStatus() {
  await sendJson('/api/companions/me/online', 'PATCH', {
    online: document.getElementById('online-toggle').checked,
  });
  showAlert('Đã cập nhật trạng thái online.');
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
        customerName: b.customer?.fullName || b.customer?.username || `User #${b.customer?.id || '-'}`,
        location: b.location || '-',
      };
    })
    .filter((x) => x.start && x.end)
    .sort((a, b) => a.start - b.start);

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
            <td>Booking #${slot.id} - ${escapeHtml(slot.customerName)} (${escapeHtml(slot.location)})</td>`;
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
  showAlert(`Đã cập nhật booking #${bookingId} -> ${status}.`);
}

async function checkInBooking(bookingId) {
  try {
    await sendJson(`/api/bookings/me/${bookingId}/check-in`, 'PATCH', {});
    await loadBookings();
    await loadBookingWorkflow();
    showAlert(`Đã check-in booking #${bookingId}. Phiên đã bắt đầu.`);
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
    showAlert(`Đã check-out booking #${bookingId}. Đơn đã hoàn tất.`);
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
  showAlert(`Đã gửi SOS cho booking #${bookingId}.`, 'warning');
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
      booking?.customer?.fullName || booking?.customer?.username || `User #${booking?.customer?.id || '-'}`;
    const bookingTime = fmtDateTime(booking?.bookingTime);
    const location = booking?.location || '-';
    noteInput.value = `SOS khẩn cấp tại booking #${bookingId}. Khách hàng: ${customer}. Thời gian: ${bookingTime}. Địa điểm: ${location}.`;
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
  if (!bookings.length) {
    rows.innerHTML = '<tr><td colspan="6" class="text-muted">Chưa có booking.</td></tr>';
    return;
  }
  bookings.forEach((item) => {
    const tr = document.createElement('tr');
    const canProcess = item.status === 'PENDING';
    const canCheckIn = item.status === 'ACCEPTED';
    const canCheckOut = item.status === 'IN_PROGRESS';
    const canSos = item.status === 'ACCEPTED' || item.status === 'IN_PROGRESS';
    const canChat = item.status === 'ACCEPTED' || item.status === 'IN_PROGRESS' || item.status === 'COMPLETED';
    const hasPendingExt = item.pendingExtensionMinutes != null;
    const extLine = hasPendingExt
      ? `<div class="small text-warning mb-1">Khách xin gia hạn +${item.pendingExtensionMinutes} phút</div>`
      : '';
    tr.innerHTML = `
            <td>${item.id}</td>
            <td>${escapeHtml(item.customer?.fullName || item.customer?.username || '')}</td>
            <td>${escapeHtml(fmtDateTime(item.bookingTime))}</td>
            <td>${item.duration} phút${extLine}</td>
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
                ${canChat ? `<a class="btn btn-sm btn-outline-dark me-2" href="../user/chat.html?bookingId=${item.id}">Chat/Call</a>` : ''}
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
}

async function saveBankAccount(e) {
  e.preventDefault();
  await sendJson('/api/companions/me/bank-account', 'PUT', {
    bankName: document.getElementById('bank-name').value.trim(),
    bankAccountNumber: document.getElementById('bank-account-number').value.trim(),
    accountHolderName: document.getElementById('account-holder-name').value.trim(),
  });
  showAlert('Đã lưu tài khoản ngân hàng nhận tiền.');
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
      authUserEl.textContent = `Xin chào, ${auth.username}`;
    }
    await pollCompanionRealtimeNotifications();
    if (auth.userId && window.RealtimeStomp) {
      try {
        await RealtimeStomp.ensureLibs();
        await RealtimeStomp.connect();
        await RealtimeStomp.subscribeNotifications(Number(auth.userId), (n) => {
          const id = Number(n.id);
          if (!companionRealtimeNotifState.seenIds.has(id)) {
            companionRealtimeNotifState.seenIds.add(id);
            showCompanionNotificationToast(n);
          }
          pollCompanionRealtimeNotifications();
        });
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

    const tasks = [];
    if (page === 'companion-dashboard') {
      tasks.push(loadBookingWorkflow(), loadIncomeStats(), loadCompanionDashboardCharts());
    }
    if (page === 'companion-profile') {
      initCompanionProfileUploads();
      tasks.push(loadProfile());
    }
    if (page === 'companion-operations') {
      tasks.push(loadAvailabilities(), loadServicePrices());
    }
    if (page === 'companion-bookings') {
      tasks.push(loadBookings(), loadBookingWorkflow(), loadConsultations());
    }
    if (page === 'companion-finance') {
      tasks.push(loadIncomeStats(), loadWithdrawals(), loadBankAccount());
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
    sorted.forEach((n) => companionRealtimeNotifState.seenIds.add(Number(n.id)));
    companionRealtimeNotifState.initialized = true;
    return;
  }
  sorted.forEach((n) => {
    const id = Number(n.id);
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
  const threadListBox = document.getElementById('chat-thread-list');
  let currentBookingId = new URLSearchParams(window.location.search).get('bookingId') || '';
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
    threadTitle.textContent = active ? `Khách hàng: ${active.partnerName}` : `Booking #${currentBookingId}`;
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
      .sort((a, b) => new Date(b.bookingTime || 0).getTime() - new Date(a.bookingTime || 0).getTime());
  }

  function resolveBookingForChat() {
    if (currentBookingId && threads.some((t) => t.bookingId === currentBookingId)) {
      return currentBookingId;
    }
    const preferred = threads.find((t) => ['IN_PROGRESS', 'ACCEPTED', 'PENDING', 'COMPLETED'].includes(t.status));
    return preferred ? preferred.bookingId : threads[0]?.bookingId || '';
  }

  function renderThreadList() {
    if (!threadListBox) return;
    if (!threads.length) {
      threadListBox.innerHTML = '<div class="p-3 text-muted">Chưa có cuộc trò chuyện khả dụng.</div>';
      return;
    }
    threadListBox.innerHTML = `<div class="list-group list-group-flush">${threads
      .map((t) => {
        const active = t.bookingId === currentBookingId ? 'bg-light' : '';
        return `<button type="button" class="list-group-item list-group-item-action border-0 border-bottom ${active} chat-thread-item" data-booking-id="${escapeHtml(t.bookingId)}">
                        <div class="fw-semibold">${escapeHtml(t.partnerName)}</div>
                        <div class="small text-muted">#${t.bookingId} • ${escapeHtml(t.status)}</div>
                    </button>`;
      })
      .join('')}</div>`;
    threadListBox.querySelectorAll('.chat-thread-item').forEach((btn) => {
      btn.addEventListener('click', async () => {
        currentBookingId = btn.getAttribute('data-booking-id') || '';
        updateThreadHeader();
        renderThreadList();
        await loadMessages();
        await resubscribeChatSocket();
      });
    });
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
          .map(
            (m) => `
            <div class="mb-2">
                <div class="small text-muted">${escapeHtml(m.sender?.username || 'Ẩn danh')} • ${escapeHtml(fmtDateTime(m.createdAt))}</div>
                <div class="p-2 rounded border bg-white">${escapeHtml(m.content || '')}</div>
            </div>
        `
          )
          .join('')
      : '<div class="text-muted">Chưa có tin nhắn.</div>';
    box.scrollTop = box.scrollHeight;
  }

  document.getElementById('chat-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentBookingId) {
      showAlert('Không tìm thấy booking phù hợp để chat.', 'warning');
      return;
    }
    const input = document.getElementById('chat-content');
    const content = (input?.value || '').trim();
    if (!content) return;
    try {
      await getJson(`/api/chat/${currentBookingId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
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
  renderThreadList();
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
