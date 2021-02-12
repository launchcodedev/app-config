---
title: Rust Support
---

## App Config in Rust

The Node.js `@app-config/cli` library has built-in support for generating Rust code.

1. Install it:

   ```sh
   npm i --save-dev @app-config/cli@2
   ```

2. Add codegen instructions to the `.app-config.meta.yml` file:

   ```yaml
   generate:
     - file: ./src/app-config.rs
   ```

3. Run the code generation:

   ```sh
   npx @app-config/cli gen
   ```

4. Use the config module!

    ```rust
    mod app_config;

    fn main() {
      let config = app_config::load_config().unwrap();

      // config gets a derive(Debug) by default
      println!("{:?}", config);
    }
    ```

**You are assumed to**:
- have `serde`, `serde_derive` and `serde_json` v1 in your crate dependencies
- have `valico` v3 in your crate dependencies

Typically, users will wrap usage of their app in the `@app-config/cli` CLI.
For example:

```sh
npx @app-config/cli -s -- cargo run
```

<br />

---

<br />

The generated code will look something like this:

```rust
use serde_derive::{Deserialize, Serialize};
use valico::json_schema;

#[derive(Debug, Serialize, Deserialize)]
pub struct Config {
    #[serde(rename = "jwt")]
    jwt: Jwt,

    #[serde(rename = "server")]
    server: Server,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Jwt {
    #[serde(rename = "secret")]
    secret: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Server {
    #[serde(rename = "port")]
    port: i64,
}

#[derive(Debug)]
pub enum Error {
    EnvironmentVariableNotFound(&'static str),
    JsonParsing(serde_json::Error),
    Validation(json_schema::ValidationState),
}

pub fn load_config() -> Result<Config, Error> {
    let config_text = match std::env::var("APP_CONFIG") {
        Ok(text) => text,
        Err(_) => {
            return Err(Error::EnvironmentVariableNotFound("APP_CONFIG"));
        }
    };

    let schema_text = match std::env::var("APP_CONFIG_SCHEMA") {
        Ok(text) => text,
        Err(_) => {
            return Err(Error::EnvironmentVariableNotFound("APP_CONFIG_SCHEMA"));
        }
    };

    let config = serde_json::from_str(&config_text).map_err(Error::JsonParsing)?;
    let schema = serde_json::from_str(&schema_text).map_err(Error::JsonParsing)?;

    let mut scope = json_schema::Scope::new();
    let schema = scope.compile_and_return(schema, false).unwrap();
    let result = schema.validate(&config);

    if !result.is_valid() {
        return Err(Error::Validation(result));
    }

    return serde_json::from_value(config).map_err(Error::JsonParsing);
}

impl std::error::Error for Error {}

impl std::fmt::Display for Error {
    fn fmt(&self, fmt: &mut std::fmt::Formatter<'_>) -> Result<(), std::fmt::Error> {
        match self {
            Error::EnvironmentVariableNotFound(var) => {
                write!(fmt, "EnvironmentVariableNotFound({})", var)?;
            }
            Error::JsonParsing(error) => {
                write!(fmt, "JSON Parsing Error: {}", error)?;
            }
            Error::Validation(state) => {
                write!(fmt, "JSON Schema Validation Error: {:?}", state)?;
            }
        }

        Ok(())
    }
}
```
