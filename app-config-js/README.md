## App Config JS Module Loader

This is a parsing extension to load arbitrary JavaScript code.

Add to meta file:

```yaml
parsingExtensions:
  - @app-config/js
```

Use it:

```yaml
foo:
  $jsModule: './another-file.js'
```

The API of this module is documented via TypeScript definitions.

Read the [Introduction](https://app-config.dev/guide/intro/) or
[Quick Start](https://app-config.dev/guide/intro/quick-start/) guides on our website.
