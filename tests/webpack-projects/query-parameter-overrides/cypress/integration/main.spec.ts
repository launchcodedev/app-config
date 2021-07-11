describe('Config Loading', () => {
  it('should render the configuration', () => {
    cy.visit('/');

    cy.get('body').should('contain', `"urlProperty": "https://example.com"`);
    cy.get('body').should(
      'contain',
      `"longStringProperty": "some long string with a \\" char and '\\\\n"`,
    );
  });

  it('should load query parameter override', () => {
    cy.visit(`/?config=${JSON.stringify({ urlProperty: 'http://google.ca' })}`);

    cy.get('body').should('contain', `"urlProperty": "http://google.ca"`);
    cy.get('body').should(
      'contain',
      `"longStringProperty": "some long string with a \\" char and '\\\\n"`,
    );
  });

  it('should not accept invalid query parameter override', () => {
    cy.visit(`/?config=${JSON.stringify({ urlProperty: 'not a url' })}`);

    cy.get('body').should('contain', `Config Error: must match format "uri"`);
  });

  it('should not accept invalid longStringProperty', () => {
    cy.visit(`/?config=${JSON.stringify({ longStringProperty: 'short' })}`);

    cy.get('body').should('contain', `Config Error: must NOT have fewer than 10 characters`);
  });
});
