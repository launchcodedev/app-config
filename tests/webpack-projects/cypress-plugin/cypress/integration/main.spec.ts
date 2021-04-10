import '@app-config/cypress';
import config from '@app-config/main';

describe('Config Loading', () => {
  it('should render the configuration', () => {
    cy.visit('/');

    cy.get('body').should('contain', `"urlProperty": "https://example.com"`);
    cy.get('body').should(
      'contain',
      `"longStringProperty": "some long string with a \\" char and '\\\\n"`,
    );
  });

  it('should mock the configuration value', () => {
    cy.setAppConfig({
      urlProperty: 'https://overwritten.com',
      longStringProperty: 'shorter than before',
    });

    cy.visit('/');

    cy.get('body').should('contain', `"urlProperty": "https://overwritten.com"`);
    cy.get('body').should('contain', `"longStringProperty": "shorter than before"`);
  });

  it('should fail when overriden with an invalid value', () => {
    cy.setAppConfig({
      urlProperty: 'https://overwritten.com',
      longStringProperty: 'short!',
    });

    cy.visit('/');

    cy.get('body').should('contain', `Config Error: must NOT have fewer than 10 characters`);
  });

  it('uses config from webpack preprocessor', () => {
    cy.setAppConfig(config);
    cy.visit('/');

    cy.get('body').should('contain', `"urlProperty": "https://example.com"`);
    cy.get('body').should(
      'contain',
      `"longStringProperty": "some long string with a \\" char and '\\\\n"`,
    );
  });
});
