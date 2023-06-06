const { createPlugin } = require('@app-config/esbuild');

require('esbuild')
  .build({
    bundle: true,
    entryPoints: ['./src/index.ts'],
    outfile: './dist/index.js',
    plugins: [createPlugin()],
  })
  .catch(() => process.exit(1));
