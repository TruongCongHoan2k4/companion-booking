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
    throw new Error(await res.text());
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

async function registerCompanion(e) {
  e.preventDefault();
  const payload = {
    bio: document.getElementById('bio').value.trim(),
    hobbies: document.getElementById('hobbies').value.trim(),
    appearance: document.getElementById('appearance').value.trim(),
    availability: document.getElementById('availability').value.trim(),
    serviceType: document.getElementById('serviceType').value.trim(),
    area: document.getElementById('area').value.trim(),
    rentalVenues: document.getElementById('rentalVenues').value.trim(),
    gender: document.getElementById('gender').value.trim(),
    gameRank: document.getElementById('gameRank').value.trim(),
    onlineStatus: String(document.getElementById('onlineStatus').checked),
    skills: document.getElementById('skills').value.trim(),
    identityNumber: document.getElementById('identityNumber').value.trim(),
  };

  await getJson('/api/companions/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  // Upload định danh & media (nếu có)
  const fd = new FormData();
  fd.append('identityNumber', payload.identityNumber || '');
  const idImg = document.getElementById('identityImage')?.files?.[0];
  const portrait = document.getElementById('portraitImage')?.files?.[0];
  const intro = Array.from(document.getElementById('introMedia')?.files || []);
  if (idImg) fd.append('identityImage', idImg, idImg.name);
  if (portrait) fd.append('avatar', portrait, portrait.name);
  intro.forEach((f) => fd.append('introMedia', f, f.name));
  if (idImg || portrait || intro.length || payload.identityNumber) {
    await fetch('/api/companions/application/identity', {
      method: 'PUT',
      credentials: 'include',
      headers: {
        ...(localStorage.getItem('token') ? { Authorization: `Bearer ${localStorage.getItem('token')}` } : {}),
      },
      body: fd,
    }).then(async (r) => {
      if (!r.ok) throw new Error((await r.json().catch(() => null))?.message || (await r.text()));
      return r.json().catch(() => ({}));
    });
  }

  showAlert('Gửi đăng ký thành công. Vui lòng chờ Admin duyệt hồ sơ.', 'success');
  setTimeout(() => {
    window.location.href = '../user/index.html';
  }, 1000);
}

async function bootstrap() {
  try {
    const auth = await getJson('/api/auth/me');
    if (!auth.authenticated) {
      window.location.href = '../user/login.html';
      return;
    }
    document.getElementById('auth-user').textContent = `Xin chào, ${auth.user?.fullName || auth.username}`;
    if (auth.role === 'COMPANION') {
      showAlert('Tài khoản đã là Companion. Chuyển sang dashboard quản lý.', 'info');
      setTimeout(() => {
        window.location.href = './dashboard.html';
      }, 800);
      return;
    }

    // Prefill nếu đã từng nộp hồ sơ
    try {
      const app = await getJson('/api/companions/application/me');
      if (app) {
        document.getElementById('bio').value = app.bio || '';
        document.getElementById('hobbies').value = app.hobbies || '';
        document.getElementById('appearance').value = app.appearance || '';
        document.getElementById('availability').value = app.availability || '';
        document.getElementById('serviceType').value = app.serviceType || '';
        document.getElementById('area').value = app.area || '';
        document.getElementById('rentalVenues').value = app.rentalVenues || '';
        document.getElementById('gender').value = app.gender || '';
        document.getElementById('gameRank').value = app.gameRank || '';
        document.getElementById('skills').value = app.skills || '';
        document.getElementById('identityNumber').value = app.identityNumber || '';
        document.getElementById('onlineStatus').checked = !!app.onlineStatus;
        if (app.status === 'PENDING') {
          showAlert('Hồ sơ đang chờ Admin duyệt. Bạn có thể cập nhật và gửi lại.', 'info');
        }
      }
    } catch (_) {}

    document.getElementById('register-form').addEventListener('submit', async (e) => {
      try {
        await registerCompanion(e);
      } catch (err) {
        showAlert(`Không thể đăng ký: ${err.message}`, 'danger');
      }
    });
  } catch (_) {
    window.location.href = '../user/login.html';
  }
}

document.getElementById('logout-btn').addEventListener('click', async (e) => {
  e.preventDefault();
  try {
    const token = localStorage.getItem('token');
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
