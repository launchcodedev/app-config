## App Config Cypress

This package provides utilities to use App Config with Cypress.io.

Install:

```sh
yarn add -D @app-config/cypress
```

Add to `./cypress/support/index.js`:

```javascript
require('@app-config/cypress').register();
```

In your integration tests:

```typescript
// this import will import the types for setAppConfig!
import '@app-config/cypress';

describe('Config Loading', () => {
  it('should mock the configuration value', () => {
    cy.setAppConfig({
      foo: 'https://overwritten.com',
      bar: 'some configuration value',
    });

    // be sure to setAppConfig before calling visit()
    cy.visit('/');
  });
});
```