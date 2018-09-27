# App Config Loader - For Node.js

> Configuration loader supporting types + validation + hierarchy + lists

## Why this?

Config loaders like [`dotenv`](https://github.com/motdotla/dotenv#readme) are fantastic for bringing configuration to a project through environment variables, however they miss some important features. This library fills in the gaps with:

* **Typing** - Config variables have types. Environment variables alone do not store type information.

* **Validation** - Config variables are validated against a schema. This enforces valid configuration when the app loads, and will  fail immediately if invalid (fail-fast).

* **Hierarchy** - Config variables can have hiearachy. This can help organize configuration into meaningful and readable parts.

* **Lists** - Config can include lists of variables. This can be useful when a dynamic number of settings is required, and can be difficult to do with plain environment variables.

## How does it work?

The above features are accomplished by representing configuration as [TOML](https://github.com/toml-lang/toml).

The TOML is stored in either a `.app-config.toml` file in development, or a single `APP_CONFIG` environment variable in testing/staging/production. Please read [The Twelve-Factor App](https://12factor.net/config) for why configuration should be stored in an environment variable.

The TOML is validated against standard [JSON schema](https://json-schema.org/) that lives in `.app-config.schema.json`.

## Getting started

1. Add this module to your project:

    **NPM**
    ```bash
    npm install --save @servall/app-config
    ```
    **Yarn**
    ```bash
    yarn add @servall/app-config
    ```

2. Add a `.app-config.toml` file to the root of your project with some config data:

    ```toml
    [webServer]

    port = 3000
    ```

3. Add a `.app-config.schema.json` to the root of your project. This validates the configuration before the app starts:

    ```json
    {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "webServer": {
          "$ref": "#/definitions/WebServer"
        }
      },
      "definitions": {
        "WebServer": {
          "type": "object",
          "properties": {
            "port": {
              "type": "number"
            }
          },
          "required": [ "port" ]
        }
      },
      "required": [ "webServer" ]
    }
    ```

    The above schema defines a required `webServer` object which contains a required `port` field that must be a `number`.

  4. Load the config in your app:

      ```javascript
      import config from '@servall/app-config';
      import * as express from 'express';

      const app = express();

      app.get('/', (req, res) => res.send('Hello World!'))

      const server = app.listen(config.webServer.port, () => {
        console.log(`Example app listening on port ${server.address().port}!`);
      });
      ```

      If anything in the configuration was incorrect, `app-config` would throw an error on app load that includes details on what was incorrect.

  5. (Optional) Define TypeScript `Config` interface:

      If you are using TypeScript, you will likely want to create an interface that describes your config so that it can be type checked. We can augment the `Config` interface exported by `app-config` to include our own typings.

      1. Create a `types/` directory under `src/` if it does not exist:

          ```bash
          mkdir -p ./src/types
          ```

      2. Create a `config.d.ts` definition file under `src/types/`:

          ```typescript
          import '@servall/app-config';
          import { SomeOtherConfig } from '../some-other-lib'

          // Augment app-config's 'Config' interface with this project's config
          declare module '@servall/app-config' {

            export interface WebServerConfig {
              port: number;
            }

            export interface DatabaseConfig {
              host: string;
              port: number;
              user: string;
              password: string;
              database: string;
            }

            export interface Config {
              webServer: WebServerConfig;
              database: DatabaseConfig;
              somethingElse: SomeOtherConfig;
            }
          }
          ```

## Environment variable generation

Most third party tooling/apps accept configuration only through single key-value environment variables. You may want to share TOML config variables with these apps without defining them again.

This module comes with an `app-config` CLI command to solve this. Simply add `app-config` before a command and it will inherit a flattened list of environment variables from the TOML.

For example, a TOML config containing:

```toml
[database]

name = "test_db"
user = "db_user"
password = "Dev123!"
host = "localhost"
port = 5432
```

will produce environment variables:

```bash
APP_CONFIG_DATABASE_NAME=test_db
APP_CONFIG_DATABASE_USER=db_user
APP_CONFIG_DATABASE_PASSWORD=Dev123!
APP_CONFIG_DATABASE_HOST=localhost
APP_CONFIG_DATABASE_PORT=5432
```

To pass these into `docker-compose` for example, your `package.json` script would look like:

```json
{
  "scripts": {
    "services:start": "app-config docker-compose up -d",
    "services:stop": "app-config docker-compose down"
  }
}
```

## Features Roadmap

- [x] TOML parsing
- [x] JSON Schema validation
- [x] Flattened environment variable generation
- [ ] Built-in TypeScript to JSON schema generation
- [ ] Meta configuration file
- [ ] Support for other config formats (YAML, JSON)
