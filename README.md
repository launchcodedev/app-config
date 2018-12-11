# App Config
Easily create configurations for your application, with strong typing, schema
validation, and many supported file formats.

## Why this?
Config loaders like [`dotenv`](https://github.com/motdotla/dotenv#readme) are
great for bringing configuration to a project through environment variables.
This approach does not allow for type safety or validation without manual
intervention. This library fills in the gaps:

- **Types** - All config variables have types. Environment variables alone do not store type information.
- **Validation** - Config variables are validated against a JSON schema.  This ensures that configurations are valid, when the app loads instead of when you least expect it.
- **Hierarchy** - Config variables can have hiearachy and structure.
- **Code Generation** - Configuration schemas can be used to generate correct types in your language of choosing (typescript, swift, rust, and many more), all automatically.
- **Configuration Formats** - Everyone has their own preferences for configuration format - supports JSON, JSON5, TOML, YAML out of the box.
- **Lists** - Config can include lists of variables. This can be useful when a dynamic number of settings is required, and can be difficult to do with plain environment variables.

## How does it work?
The configuration is stored in either an `.app-config.{filetype}` file in
development, or a single `APP_CONFIG` environment variable in deployments.
Please read [The Twelve-Factor App](https://12factor.net/config) for why
it's a good idea to put configuration in environment variables.

The configuration is validated against standard
[JSON schema](https://json-schema.org/) that lives in `.app-config.schema.{filetype}`.

The app config file, and the schema file, can both be in any supported format.
We recommend `.toml` for configuration and `.yml` for schema, which tends to be
the most concise and readable blend. But you are free to use any format you wish,
converting from one to another is trivial.

## Getting started
1. Add this module to your project:

    ```bash
    yarn add @servall/app-config
    ```

2. Add a `.app-config.toml` file to the root of your project with some config data:

    ```toml
    [server]
    port = 3000
    ```

3. Add a `.app-config.schema.yml` to the root of your project. This validates the configuration before the app starts:

    ```yaml
    $schema: http://json-schema.org/draft-07/schema#
    type: object
    required: [server]
    properties:
      server:
        "$ref": "#/definitions/Server"
    definitions:
      Server:
        type: object
        required:
        - port
        properties:
          port:
            type: number
    ```

    The above schema defines a required `Server` object which contains a required
    `port` field that must be a `number`.

  4. Load the config in your app:

      ```javascript
      import config from '@servall/app-config';
      import Server from 'my-server';

      const app = new Server();

      app.listen(config.server.port);
      console.log(`Server listening on port ${config.server.port}!`);
      ```

      If anything in the configuration was incorrect, `app-config` would throw
      an error on app load that includes details on what was incorrect.

  5. (Optional) Running code generation for TypeScript types:

      If you are using TypeScript, you will likely want to create an interface
      that describes your config so that it can be type checked.

      We can use app-config's built-in support for code generation for this.

      First, define where and what kind of codegen. There are four options
      on where to do this. It can be added to a special `app-config` root-level
      property in your app-config file, or your schema file. It can also be
      added to a 'meta' file, `.app-config.meta.{filetype}`, without the
      need for a top level `app-config`. Alternatively, you can define an
      `"app-config"` section in your `package.json`.

      In your schema or config file, add something equivalent to:

      ```yaml
      app-config:
        generate:
          - { type: 'ts', file: 'src/config-types.ts' }
      ```

      Or, in your meta file, add:

      ```yaml
      generate:
        - { type: 'ts', file: 'src/config-types.ts' }
      ```

      In your server, simply call:

      ```javascript
      import { generateTypeFiles } from '@servall/app-config';

      {
        // ... server startup

        await generateTypeFiles();
      }
      ```

      That will create a file called `src/config-types.ts` with interfaces for `app-config`.

      Alternatively, you can also do the same thing with the CLI.

      ```bash
      app-config generate
      ```

      Now you'll likely want to be able to use this type in your code. The recommended
      approach to do so is to use a wrapper file, maybe called `config.ts`.

      ```typescript
      import config from '@servall/app-config';
      import { Config } from './config-types';
      export default config as Config;
      ```

      This approach is slightly manual, but avoids issues with TypeScript
      typeRoot and defining modules. It also allows you to use app-config
      many times in one project, if you wished. You're free to choose whatever
      way you feel is best for your project.

## Environment variable generation
Most third party tooling/apps accept configuration only through single key-value
environment variables. You may want to share config variables with these apps
without defining them again.

This module comes with an `app-config` CLI command to solve this. Simply add
`app-config --` before a command and it will inherit a flattened list of environment
variables from the configuration.

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
    "services:start": "app-config -- docker-compose up -d",
    "services:stop": "app-config -- docker-compose down"
  }
}
```

#### Secrets
By default the CLI will not generate environment variables for config secrets.
To explicitly include these secrets, pass the `-s` or `--secrets` flag:

```bash
app-config --secrets -- env
```

#### Node API
App Config does export a basic node API to do the things you would expect:

```typescript
// this is an already validated config object
export default config;
export {
  // loads app config from the filesystem
  loadConfig(cwd?),
  loadConfigSync(cwd?),
  // loads app config schema from the filesystem
  loadSchema(cwd?),
  loadSchemaSync(cwd?),
  // validates the config against a schema
  validate(LoadedConfig & { schema }),
  // creates generated files defined in the schema
  generateTypeFiles(cwd?),
} from './schema';
```

## Features Roadmap

- [x] TOML parsing
- [x] JSON Schema validation
- [x] Flattened environment variable generation
- [x] Built-in JSON schema to TypeScript generation
- [x] Meta configuration file (through `app-config` meta property or `.app-config.meta` file)
- [x] Support for other config formats (YAML, JSON)
- [ ] TypeScript generation w/ declare module?
