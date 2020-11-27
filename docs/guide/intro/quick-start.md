---
title: Quick Start
---

::: tip In a rush?
If not - head over to the [introduction](./README.md).
:::

### Installation

For yarn projects:

```
yarn add @lcdev/app-config@2
```

For npm projects:

```
npm i @lcdev/app-config@2
```

### Usage

You'll need a [JSON Schema](https://json-schema.org/) file before loading config.
Add the file below to your project root.

<h4 style="text-align:center">.app-config.schema.yml</h4>

```yaml
type: object
additionalProperties: false

required:
  - server
  - database

properties:
  server: { $ref: '#/definitions/Server' }
  database: { $ref: '#/definitions/Database' }

definitions:
  Server:
    type: object
    additionalProperties: false
    required: [port]
    properties:
      port: { $ref: '#/definitions/IpPort' }

  Database:
    type: object
    additionalProperties: false
    required: [host, port]
    properties:
      host: { type: string }
      port: { $ref: '#/definitions/IpPort' }
      database: { type: string }

  IpPort:
    type: integer
    minimum: 0
    maximum: 65535
```

Of course, you're likely to want different options here. Build any JSON Schema
that fits your use case.

Now, add an app-config file in the same directory.

<h4 style="text-align:center">.app-config.yml</h4>

```yaml
server:
  port:
    $env:
      default: 3000
      production: 80

database:
  host: localhost
  port: 5432
  database: my-app
```

You've now seen an example of `$env`. This is governed by `APP_CONFIG_ENV`, `NODE_ENV` or `ENV`.

Now try to load the configuration that you just wrote, using the app-config CLI.

```sh
$ npx app-config vars
APP_CONFIG_SERVER_PORT=3000
APP_CONFIG_DATABASE_HOST="localhost"
APP_CONFIG_DATABASE_PORT=5432
APP_CONFIG_DATABASE_DATABASE="my-app"
```

From here, setup instructions differ for Node.js vs Webpack vs React Native. As an example,
here's how a simple Node.js app works.

<h4 style="text-align:center">my-app.ts</h4>

```typescript
import { config, loadConfig } from '@lcdev/app-config';

async function main() {
  await loadConfig();

  // anywhere in your app, after loadConfig is complete and resolved
  console.log(config); // this is a JSON object, loaded from the YAML file
}
```

### Learn More
From this point on, there's lots to try out! Or, keep it simple and just use the basics.

- [Node.js Setup](../node/README.md)
- [Webpack Setup](../webpack/README.md)
- [React Native Setup](../react-native/README.md)
- [`$extends` directive for re-use](./extensions.md)
- [`$env` directive environment specific variables](./extensions.md)
- ["Secrets" to avoid committing sensitive values](./secrets.md)
- [Value encryption to commit secrets](./encryption.md)
- [TypeScript code/type generation to keep schema and code in-line](./codegen.md)
