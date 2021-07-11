## Contributing to App Config

Thank you for your interest in contributing!

Below is a 'quick start' guide to developing. If there are details
that we are missing here, feel free to file an issue or correct mistakes!

### Building

We use `yarn`, and you should too if adding or removing any npm packages.

```
# installs third-party dependencies
yarn install

# builds all sub-packages
yarn build

# runs unit tests
yarn test

# runs our linter
yarn lint
```

### Pull Request

We will happily accept pull requests of any kind. Be sure that the tests
pass and that the linter is happy before filling a PR, otherwise we'll
need to tell you to fix those issues.

If you are adding anything new or changing behavior, please add applicable tests.

### Architecture

- `@app-config/utils`: common isomorphic utilities
- `@app-config/test-utils`: common logic for tests
- `@app-config/logging`: common logging logic
- `@app-config/core`: isomorphic shared logic - ParsedValue and extensions
- `@app-config/node`: utilities specific to node.js
- `@app-config/encryption`: for pgp logic and keychains
- `@app-config/cli`: for the CLI
- `@app-config/git`: `$git` parsing extension
- `@app-config/v1-compat`: v1 version compatibility extension
- `@app-config/extensions`: common parsing extensions
- `@app-config/generate`: code generation
- `@app-config/config`: config loading
- `@app-config/meta`: meta file loading
- `@app-config/settings`: settings file loading
- `@app-config/schema`: schema loading and validation
- `@app-config/inject`: runtime injection into HTML files
- `@app-config/webpack`: webpack plugin
- `@app-config/rollup`: rollup plugin
- `@app-config/vite`: vite plugin
- `@app-config/main`: main config singleton and loading logic
- `@lcdev/app-config`: alias for `@app-config/main`
- `@lcdev/app-config-webpack-plugin`: alias for `@app-config/webpack`
- `@lcdev/app-config-inject`: alias for `@app-config/inject`
- `@lcdev/react-native-app-config-transformer`: alias for `@app-config/inject`
