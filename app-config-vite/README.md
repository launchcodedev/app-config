## App Config Vite

Use app-config with vite.

Install:

```sh
yarn add -D @app-config/vite
```

Add to your `vite.config.js`:

```typescript
import appConfigVite from '@app-config/vite';

export default {
  plugins: [appConfigVite()],
};
```

This will allow you to use the `config` export from `@app-config/main` without calling `loadConfig`!
