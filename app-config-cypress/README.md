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

### Using Config in Tests

Use the [Webpack Preprocessor](https://github.com/cypress-io/cypress/blob/master/npm/webpack-preprocessor/README.md) with the [App Config Plugin](https://app-config.dev/guide/webpack/).

Cypress only allows one preprocessor at once, so we can't provide a preprocessor to do this.

Example `./cypress/plugins/index.js`:

```javascript
const webpackPreprocessor = require('@cypress/webpack-preprocessor');
const { default: AppConfigPlugin } = require('@app-config/webpack');

module.exports = (on) => {
  const options = {
    webpackOptions: {
      mode: 'development',
      module: {
        rules: [
          { test: AppConfigPlugin.regex, use: { loader: AppConfigPlugin.loader } },
          {
            test: /\.jsx?$/,
            exclude: [/node_modules/],
            use: [
              {
                loader: 'babel-loader',
                options: {
                  presets: ['@babel/preset-env'],
                },
              },
            ],
          },
          {
            test: /\.tsx?$/,
            use: 'ts-loader',
            exclude: /node_modules/,
          },
        ],
      },
      plugins: [new AppConfigPlugin()],
    },
  };

  on('file:preprocessor', webpackPreprocessor(options));
};
```

This allows you to use `@app-config/main` imports in your tests, hassle free.
