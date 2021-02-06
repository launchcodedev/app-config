import { isBrowser, isNode } from '@app-config/core';

describe('Config Loading', () => {
  it('should render the parsed value', () => {
    cy.visit('/');

    cy.get('body').should('contain', `{"foo":"bar","baz":{"qux":42}}`);
  });

  it('should detect browser environment', () => {
    expect(isBrowser).to.equal(true);
    expect(isNode).to.equal(false);
  });
});
