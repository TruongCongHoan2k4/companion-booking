describe('Authentication (React /auth.html)', () => {
  const user = Cypress.env('e2eUser');
  const password = Cypress.env('e2ePassword');

  beforeEach(() => {
    cy.clearLocalStorage();
  });

  it('đăng nhập thành công: chuyển tới Ví & đặt lịch và hiện toast thành công', function () {
    if (!user || !password) {
      cy.log('Bỏ qua: đặt CYPRESS_E2E_USER và CYPRESS_E2E_PASSWORD (tài khoản hợp lệ trên backend).');
      this.skip();
    }

    cy.visit('/auth.html#/login');
    cy.get('[data-testid="login-username"]').should('be.visible').clear().type(user);
    cy.get('[data-testid="login-password"]').should('be.visible').clear().type(password, { log: false });
    cy.get('[data-testid="login-submit"]').click();

    cy.hash().should('eq', '#/wallet-bookings');
    cy.get('[data-testid="page-wallet-bookings"]').should('be.visible');
    cy.contains('Ví & đặt lịch').should('be.visible');
    cy.contains('Đăng nhập thành công').should('be.visible');
  });

  it('đăng nhập thất bại (sai mật khẩu): toast lỗi từ API', () => {
    cy.visit('/auth.html#/login');
    cy.get('[data-testid="login-username"]').clear().type('cypress_user_khong_ton_tai');
    cy.get('[data-testid="login-password"]').clear().type('SaiMatKhau123!', { log: false });
    cy.get('[data-testid="login-submit"]').click();

    cy.hash().should('eq', '#/login');
    cy.get('p.text-rose-400').should('not.exist');
    cy.contains('Sai tên đăng nhập hoặc mật khẩu').should('be.visible');
  });

  it('cy.login(): đặt token qua API, bỏ qua form', function () {
    if (!user || !password) {
      cy.log('Bỏ qua: cần CYPRESS_E2E_USER và CYPRESS_E2E_PASSWORD.');
      this.skip();
    }
    cy.clearLocalStorage();
    cy.login(user, password);
    cy.hash().should('eq', '#/wallet-bookings');
    cy.get('[data-testid="page-wallet-bookings"]').should('be.visible');
  });
});
