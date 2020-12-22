describe('Config Loading', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('should render the configuration', () => {
    cy.get('body').should('contain', '{"externalApiUrl":"https://example.com"}');
  });
});
