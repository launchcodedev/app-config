describe('Config Loading', () => {
  it('should render the parsed value', () => {
    cy.visit('/');

    cy.get('body').should('contain', `{"foo":"bar","baz":{"qux":42}}`);
  });
});
