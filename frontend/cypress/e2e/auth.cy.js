describe('Authentication (HTML tĩnh)', () => {
  const user = Cypress.env('e2eUser');
  const password = Cypress.env('e2ePassword');

  beforeEach(() => {
    cy.clearLocalStorage();
  });

  it('đăng nhập thành công: chuyển tới Ví và hiển thị trang ví', function () {
    if (!user || !password) {
      cy.log('Bỏ qua: đặt CYPRESS_E2E_USER và CYPRESS_E2E_PASSWORD (tài khoản hợp lệ trên backend).');
      this.skip();
    }

    cy.visit('/pages/user/login.html');
    cy.get('[data-testid="login-username"]').should('be.visible').clear().type(user);
    cy.get('[data-testid="login-password"]').should('be.visible').clear().type(password, { log: false });
    cy.get('[data-testid="login-submit"]').click();

    cy.url().should('include', '/pages/user/wallet.html');
    cy.get('[data-testid="page-wallet-bookings"]').should('be.visible');
    cy.contains('Số dư ví').should('be.visible');
  });

  it('đăng nhập thất bại (sai mật khẩu): thông báo lỗi từ API', () => {
    cy.visit('/pages/user/login.html');
    cy.get('[data-testid="login-username"]').clear().type('cypress_user_khong_ton_tai');
    cy.get('[data-testid="login-password"]').clear().type('SaiMatKhau123!', { log: false });
    cy.get('[data-testid="login-submit"]').click();

    cy.url().should('include', 'login.html');
    cy.get('#auth-message').should('contain.text', 'Sai tên đăng nhập hoặc mật khẩu');
  });

  it('cy.login(): đặt token qua API, bỏ qua form', function () {
    if (!user || !password) {
      cy.log('Bỏ qua: cần CYPRESS_E2E_USER và CYPRESS_E2E_PASSWORD.');
      this.skip();
    }
    cy.clearLocalStorage();
    cy.login(user, password);
    cy.url().should('include', '/pages/user/wallet.html');
    cy.get('[data-testid="page-wallet-bookings"]').should('be.visible');
  });
});
