/** @typedef {{ token?: string; user?: { _id?: string; id?: string; role?: string } }} LoginBody */

/**
 * Đăng nhập qua API, ghi JWT vào localStorage rồi mở app (bỏ qua form UI).
 * Cần backend chạy (mặc định http://localhost:3000) và biến env CYPRESS_E2E_USER / CYPRESS_E2E_PASSWORD.
 */
Cypress.Commands.add('login', (username, password) => {
  const apiUrl = String(Cypress.env('apiUrl') || 'http://localhost:3000/api').replace(/\/$/, '');
  cy.request({
    method: 'POST',
    url: `${apiUrl}/auth/login`,
    body: { username, password },
    failOnStatusCode: false,
  }).then((response) => {
    expect(response.status, response.body?.message || 'login failed').to.eq(200);
    const body = /** @type {LoginBody} */ (response.body);
    const token = body.token;
    const user = body.user;
    expect(token, 'response.token').to.be.a('string').and.not.be.empty;
    cy.visit('/auth.html#/wallet-bookings', {
      onBeforeLoad(win) {
        win.localStorage.setItem('token', token);
        if (user?.role) win.localStorage.setItem('role', user.role);
        const uid = user?._id ?? user?.id;
        if (uid != null) win.localStorage.setItem('userId', String(uid));
      },
    });
  });
});
