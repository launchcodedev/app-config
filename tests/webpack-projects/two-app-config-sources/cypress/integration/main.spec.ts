describe('Config Loading', () => {
  it('should render both configurations', () => {
    cy.visit('/');

    cy.get('body').should('contain', `{\n  "foo": "this is foo"\n}`);
    cy.get('body').should('contain', `{\n  "bar": "this is bar"\n}`);
  });
});
