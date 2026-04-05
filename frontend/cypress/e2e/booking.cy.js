describe('Tìm kiếm & Profile Companion (trang user tĩnh)', () => {
  beforeEach(() => {
    cy.intercept('GET', '**/api/companions', { fixture: 'companions-list.json' }).as('listCompanions');
    cy.intercept('GET', '**/api/companions/507f1f77bcf86cd799439011', {
      fixture: 'companion-detail.json',
    }).as('companionById');
  });

  it('trang chủ khách: lưới companion hiển thị ít nhất một thẻ', () => {
    cy.visit('/pages/user/index.html');
    cy.wait('@listCompanions');
    cy.get('[data-testid="companion-grid"]').should('be.visible');
    cy.get('[data-testid="companion-grid"] .user-card').should('have.length.at.least', 1);
    cy.get('[data-testid="companion-grid"] .user-card')
      .first()
      .find('.card-title')
      .should('contain.text', 'E2E Companion');
  });

  it('mở chi tiết profile: ảnh/hình đại diện, tên, nút Đặt lịch', () => {
    cy.visit('/pages/user/index.html');
    cy.wait('@listCompanions');
    cy.get('[data-testid="companion-grid"] .user-card').first().contains('a', 'Xem profile').click();
    cy.url().should('include', 'profile.html');
    cy.url().should('include', 'id=507f1f77bcf86cd799439011');
    cy.wait('@companionById');

    cy.get('[data-testid="profile-container"]').within(() => {
      cy.get('h1.h4').should('contain.text', 'E2E Companion');
      cy.get('img[alt="avatar"]').should('be.visible');
      cy.contains('a.btn-primary', 'Đặt lịch').should('be.visible').should('have.attr', 'href').and('include', 'booking.html');
    });
  });
});
