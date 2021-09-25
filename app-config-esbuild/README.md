## App Config esbuild

Use app-config with esbuild.

Install:

```sh
yarn add -D @app-config/esbuild
```

Then add it to your esbuild configuration:

```javascript
const { createPlugin: appConfig } = require('@app-config/esbuild');

require('esbuild')
  .build({
    bundle: true,
    entryPoints: ['./src/index.ts'],
    outfile: './dist/index.js',
    // this is the line we care about
    plugins: [appConfig()],
  })
  .catch(() => process.exit(1));
```

This will allow you to import `@app-config/main` from your application, with all
filesystem and other Node.js code stripped out (when using `bundle`).
