---
title: Usage in Webpack
---

::: tip Before Reading
Head on over to the [Introduction](../intro/) or [Quick Start](../intro/quick-start) if you haven't already.
:::

The webpack plugin is a separate package, which you'll need to install:

```sh
yarn add @lcdev/app-config-webpack-plugin@2
```

In your webpack.config.js file, add the following:

```javascript
import AppConfigPlugin from '@lcdev/app-config-webpack-plugin';

// in your loaders:
module: {
  rules: [
    { test: AppConfigPlugin.regex, use: { loader: AppConfigPlugin.loader } },
  ],
},

// in your plugins:
plugins: [
  new AppConfigPlugin(),
]

```

In order for [app-config-inject](./inject.md) to work, you'll want to set the `headerInjection` option:

```javascript
// in your loaders:
module: {
  rules: [
    {
      test: AppConfigPlugin.regex,
      use: {
        loader: AppConfigPlugin.loader,
        options: {
          headerInjection: true,
        },
      },
    },
  ],
},

// in your plugins:
plugins: [
  new AppConfigPlugin({ headerInjection: true }),
]
```

This change tells webpack to add a little `<script id="app-config">` tag, which contains
some JavaScript code that sets `window._appConfig`. The loader cooperates by reading from
that global variable instead of inserting the config directly.

Why go through this trouble? As stated above, [app-config-inject](./inject.md) uses this fact.
When you're deploying your frontend application, you can add a short little injection script
that mutates the `index.html` with a new `<script id="app-config">`. By doing that, the web
app will have different configuration, without changing the JavaScript bundle at all. If you
really wanted to, you could even change the HTML by hand.
