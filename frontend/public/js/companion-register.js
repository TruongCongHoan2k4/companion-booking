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
  };

  await getJson('/api/companions/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  showAlert('Gửi đăng ký thành công. Vui lòng chờ Admin duyệt hồ sơ.', 'success');
  setTimeout(() => {
    window.location.href = './dashboard.html';
  }, 1000);
}

async function bootstrap() {
  try {
    const auth = await getJson('/api/auth/me');
    if (!auth.authenticated) {
      window.location.href = '../user/login.html';
      return;
    }
    document.getElementById('auth-user').textContent = `Xin chào, ${auth.username}`;
    if (auth.role === 'COMPANION') {
      showAlert('Tài khoản đã là Companion. Chuyển sang dashboard quản lý.', 'info');
      setTimeout(() => {
        window.location.href = './dashboard.html';
      }, 800);
      return;
    }
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
