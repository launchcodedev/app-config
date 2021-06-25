import '@app-config/cypress';

describe('Config Loading', () => {
  it('should render the configuration', () => {
    cy.visit('/');

    cy.get('body').should(
      'contain',
      `"stringProperty": "some long string with a \\" char and '\\\\n"`,
    );
  });

  it('should mock the configuration value', () => {
    cy.setAppConfig({
      stringProperty: 'shorter than before',
    });

    cy.visit('/');

    cy.get('body').should('contain', `"stringProperty": "shorter than before"`);
  });

  it('should fail when overriden with an invalid value', () => {
    cy.setAppConfig({
      stringProperty: 42,
    });

    cy.visit('/');

    cy.get('body').should('contain', `Config Error: should be string`);
  });
});
