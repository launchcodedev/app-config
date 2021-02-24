---
title: Code/Types Generation
---

## Code/Types Generation

Code generation is dictated by the meta file. This file lives alongside config and schema files.

<h4 style="text-align:center">.app-config.meta.yml</h4>

```yaml
generate:
  - { file: 'src/@types/lcdev__app-config/index.d.ts' }
```

Run the CLI to write the type files.

```sh
npx @app-config/cli generate
```

If you have `src/**/*` in your `include` of `tsconfig.json`, then TypeScript
should be aware of the type of the `config` export. Otherwise, you might want
to use [typeRoots](https://www.typescriptlang.org/tsconfig#typeRoots).

There are examples of code generation in each of our [example projects](https://github.com/launchcodedev/app-config/tree/master/examples).

An example of the file that's written is below:

```typescript{15}
// AUTO GENERATED CODE
// Run app-config with 'generate' command to regenerate this file

import '@app-config/main';

export interface Config {
  user?: User;
}

export interface User {
  name?: string;
}

// augment the default export from app-config
declare module '@app-config/main' {
  export interface ExportedConfig extends Config {}
}
```

By "augmenting" the module, TypeScript will know that `config` has a specific type.

Other options for the meta file:
- `file`: filepath of code to write
- `name`: export name, mostly for aesthetic reasons
- `augmentModule`: if app-config main export should be typed
- `leadingComments`: first couple lines to insert in file
- `rendererOptions`: unstable options passed to quicktype

## Go Support

See [App Config in Golang](../../spec/golang.md) page for more.

## Rust Support

See [App Config in Rust](../../spec/rust.md) page for more.
