describe('Config Loading', () => {
  it('should render the configuration', () => {
    cy.visit('/');

    cy.get('body').should('contain', `"foo": "baz"`);
  });
});
