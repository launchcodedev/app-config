## App Config Exec Plugin

Run arbitrary programs or shell commands to generate config.

```yaml
$exec: echo Hello World!
```

## Usage

#### Basic:

```yaml
$exec: echo Hello World!
```

#### Auto-parse output as YAML/TOML/JSON/JSON5:

```yaml
$exec:
  command: curl https://my-api.example.com
  parseOutput: true
```

#### Build a custom script to generate config:

```yaml
$exec: node ./my-custom-config-generator.js
```

#### Retrieve arbitrary information:

_Node v8 version:_

```yaml
$exec: node -p -e "process.versions.v8"
```

_System's architecture:_

```yaml
$exec: uname -p
```

#### Retrieve list of AWS S3 buckets via `aws` & `jq` CLI:

```yaml
$exec:
  command: aws s3api list-buckets --output json | jq -r '.Buckets'
  parseOutput: true
```

_Note: When possible, we encourage you to build a dedicated extension to better support features you are looking for (and help out the community). eg. `$aws` directive instead of the above._

## Installing

Install and use:

```sh
yarn add @app-config/exec
```

In `.app-config.meta.yml` file:

```yaml
parsingExtensions:
  - '@app-config/exec'
```

## Options

The following options can be passed to each `$exec` directive:

```yaml
$exec:
  command: echo Hello World!
  trimWhitespace: true
  parseOutput: false
  failOnStderr: false
```

#### `command: string`:

The command to run. Should be a single `string` containing both command and arguments. The command's `stdout` will be used as the resulting value. Runs in a shell, `/bin/sh` on Unix and `process.env.ComSpec` on Windows.

#### `trimWhitespace: boolean`:

If `true`, automatically trim whitespace from the start and end of the command's output. Useful to remove the trailing newline produced by most commands. If `false`, output will be left in its raw form. Default `true`.

#### `parseOutput: boolean`:

If `true`, automatically guess output content type (YAML, TOML, JSON, or JSON5) and parse. Throws if parse fails. If `false`, output will be read as a `string`. Default `false`.

#### `failOnStderr: boolean`:

If `true`, fail if any output is found in command's `stderr`. Default `false`.
