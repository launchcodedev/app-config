## App Config Rollup

Use app-config with rollup.

Install:

```sh
yarn add -D @app-config/rollup
```

Add to your `rollup.config.js`:

```typescript
import appConfigRollup from '@app-config/rollup';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/index.js',
    format: 'cjs',
  },
  plugins: [appConfigRollup()],
};
```

This will allow you to use the `config` export from `@app-config/main` without calling `loadConfig`!
