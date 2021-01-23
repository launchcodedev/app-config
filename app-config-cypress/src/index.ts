import type { ExportedConfig } from '@lcdev/app-config';

export function register() {
  Cypress.Commands.add('setAppConfig', { prevSubject: false }, (configuration: ExportedConfig) => {
    cy.on('window:before:load', (window) => {
      Object.defineProperty(window, '_appConfig', {
        configurable: false,
        set() {},
        get() {
          return configuration;
        },
      });
    });
  });
}

declare namespace Cypress {
  interface Chainable {
    setAppConfig(configuration: ExportedConfig): Chainable;
  }
}