---
title: Usage in Webpack
---

::: tip Before Reading
Head on over to the [Introduction](../intro/) or [Quick Start](../intro/quick-start) if you haven't already.
:::

The webpack plugin is a separate package, which you'll need to install:

```sh
yarn add @app-config/webpack@2
```

In your webpack.config.js file, add the following:

```javascript
import AppConfigPlugin from '@app-config/webpack';

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

This change tells webpack to add a `<script id="app-config">` tag, which contains
some JavaScript code that sets `window._appConfig`. The loader cooperates with this
by reading from that global variable instead of inserting the config directly.

Why go through this trouble? As stated above, [app-config-inject](./inject.md)
uses this fact. When you're deploying your frontend application, you can add a
short injection script that mutates the `index.html` with a new `<script id="app-config">`.
By doing that, the web app will have different configuration, without changing
the JavaScript bundle at all. If you really wanted to, you could even change the
HTML by hand.

### Loading Options

If you need to, you can pass options for the webpack plugin to use when loading app-config.

```javascript
// in your loaders:
module: {
  rules: [
    {
      test: AppConfigPlugin.regex,
      use: {
        loader: AppConfigPlugin.loader,
        options: {
          loading: {
            // any options that are valid for loadConfig are valid here
            directory: 'conf',
            fileNameBase: '.my-config',
          },
        },
      },
    },
  ],
},

// in your plugins:
plugins: [
  new AppConfigPlugin({ loading: { /* this should be the same as the loader */ } }),
]
```

### Validation

A niche but useful way to use App Config involves using query parameters as configuration override.
This can be a good way to quickly change the way an app behaves, without a full deployment.

Thankfully, App Config gives us the tools to do that! Some small amount of glue code is required,
since every application could want to do this a slightly different way.

The basics are:

```typescript
import { config, validateConfig } from '@lcdev/app-config';
import merge from 'lodash.merge';

const queryParameters = new URLSearchParams(document.location.search);

let fullConfig: typeof config;

// here, a user could specify my-site.com/?config={"foo":"bar"}
// we'll read the parameter as JSON, and merge it on top of the config
// the reading and merging strategy here are up to you entirely

if (queryParameters.has('config')) {
  const overrides = JSON.parse(queryParameters.get('config'));

  fullConfig = merge({}, config, overrides);
} else {
  fullConfig = config;
}

// App Config gives us a validation function, straight from AJV!
// NOTE that it is only available when using the Webpack plugin, not in Node.js
// the code is generated on the fly at build time, to be as slim as possible

validateConfig(fullConfig);

// access the .errors property, like AJV
if (validateConfig.errors) {
  console.error(validateConfig.errors.map((err) => err.message).join(', '));
} else {
  document.body.innerHTML = `<pre>${JSON.stringify(fullConfig, null, 2)}</pre>`;
}
```
