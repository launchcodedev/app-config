## Contributing to App Config
Thank you for your interest in contributing to app-config!

Below is a 'quick start' guide to developing. If there are details
that we are missing here, feel free to file an issue or correct mistakes!

### Building
We use `yarn`, and you should too if adding or removing any npm packages.

```
yarn install

# runs the transpiler, outputs in ./dist
yarn build

# runs the unit tests
yarn test

# runs our linter
yarn lint
```

### Pull Request
We will happily accept pull requests of any kind. Be sure that the tests
pass and that the linter is happy before filling a PR, otherwise we'll
need to tell you to fix those issues.

If you are adding anything new or changing behavior, please add applicable tests.
