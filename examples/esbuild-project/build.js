require('esbuild')
  .build({
    bundle: true,
    entryPoints: ['./src/index.ts'],
    outfile: './dist/index.js',
    plugins: [require('@app-config/esbuild').default],
  })
  .catch(() => process.exit(1));
