---
title: Code/Types Generation
---

Code generation is dictated by the meta file.

<h4 style="text-align:center">.app-config.meta.yml</h4>

```yaml
generate:
  - { file: 'src/@types/lcdev__app-config/index.d.ts' }
```

Currently, only TypeScript output is officially supported. Others may work since
we rely on [quicktype](https://quicktype.io/).

Run the CLI the write the types file.

```sh
npx app-config generate
```

If you have `src/**/*` in your `include` of `tsconfig.json`, then TypeScript
should be aware of the type of the `config` export. Otherwise, you might want
to use [typeRoots](https://www.typescriptlang.org/tsconfig#typeRoots).

There are examples of code generation in each of our example projects.

An example of the file that's written is below:

```typescript{15}
// AUTO GENERATED CODE
// Run app-config with 'generate' command to regenerate this file

import '@lcdev/app-config';

export interface Config {
  user?: User;
}

export interface User {
  name?: string;
}

// augment the default export from app-config
declare module '@lcdev/app-config' {
  export interface ExportedConfig extends Config {}
}
```

By "augmenting" the module, TypeScript will know that when importing `config`,
it has a specific type.
