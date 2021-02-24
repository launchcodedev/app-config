/// <reference types="cypress" />
import type { ExportedConfig } from '@app-config/main';

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

declare global {
  namespace Cypress {
    interface Chainable {
      setAppConfig(configuration: ExportedConfig): Chainable<Element>;
    }
  }
}
