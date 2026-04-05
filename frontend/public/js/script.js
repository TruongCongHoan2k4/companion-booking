document.addEventListener('DOMContentLoaded', () => {
    updateAuthNavigation();
    const companionGrid = document.getElementById('companion-grid');

    if (companionGrid) {
        fetch('/api/companions')
            .then(response => response.json())
            .then(data => {
                companionGrid.innerHTML = '';
                if (data.length === 0) {
                    companionGrid.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">Chưa có bạn đồng hành nào được duyệt.</p>';
                    return;
                }
                data.forEach(companion => {
                    const card = document.createElement('div');
                    card.className = 'companion-card';
                    card.innerHTML = `
                        <div class="companion-img"></div>
                        <div class="companion-info">
                            <div class="companion-name">${companion.user.fullName || companion.user.username}</div>
                            <div class="companion-bio">${companion.bio || 'Chưa có giới thiệu.'}</div>
                            <a href="/user/profile.html?id=${companion.id}" class="btn" style="background-color: var(--primary-color); color: white; padding: 0.5rem 1rem; width: 100%; text-align: center;">Xem hồ sơ</a>
                        </div>
                    `;
                    companionGrid.appendChild(card);
                });
            })
            .catch(error => {
                console.error('Error fetching companions:', error);
                companionGrid.innerHTML = '<p style="text-align: center; grid-column: 1/-1;">Lỗi khi tải dữ liệu. Vui lòng thử lại sau.</p>';
            });
    }
});

function updateAuthNavigation() {
    const nav = document.querySelector('header nav');
    if (!nav) {
        return;
    }

    const token = localStorage.getItem('token');
    fetch('/api/auth/me', {
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
        .then((response) => (response.ok ? response.json() : { authenticated: false }))
        .then(auth => {
            if (!auth.authenticated) {
                return;
            }

            const links = Array.from(nav.querySelectorAll('a'));
            links.forEach(link => {
                const href = link.getAttribute('href');
                if (href === '/login' || href === '/login.html'
                    || href === '/register' || href === '/register.html'
                    || href === '/user/login' || href === '/user/register'
                    || href === '/user/login.html' || href === '/user/register.html') {
                    link.remove();
                }
            });

            if (auth.role === 'COMPANION') {
                const dashboardLink = document.createElement('a');
                dashboardLink.href = '/companion/dashboard.html';
                dashboardLink.textContent = 'Khu vực Companion';
                nav.appendChild(dashboardLink);
            }

            const logoutLink = document.createElement('a');
            logoutLink.href = '#';
            logoutLink.textContent = 'Đăng xuất';
            logoutLink.addEventListener('click', (event) => {
                event.preventDefault();
                const token = localStorage.getItem('token');
                fetch('/api/auth/logout', {
                    method: 'POST',
                    credentials: 'include',
                    headers: {
                        'Content-Type': 'application/json',
                        ...(token ? { Authorization: `Bearer ${token}` } : {}),
                    },
                })
                    .finally(() => {
                        localStorage.removeItem('token');
                        localStorage.removeItem('role');
                        localStorage.removeItem('userId');
                        window.location.href = '/user/index.html';
                    })
                    .catch((error) => {
                        console.error('Error logging out:', error);
                    });
            });
            nav.appendChild(logoutLink);
        })
        .catch(error => {
            console.error('Error fetching auth status:', error);
        });
}
