---
title: API Reference
---

`loadConfig(Options?)`: Read and validate configuration. Fills in the `config` export.

`config` & default export: The single instance of loaded configuration, accessible after `loadConfig`.

`ExportedConfig`: Canonical type that configuration conforms to. Augmented in [code generation](../intro/codegen.md).

`Options` | `ConfigLoadingOptions`: Options for loading configuration - see TypeScript types.

`Options` | `SchemaLoadingOptions`: Options for loading schemas - see TypeScript types.

`loadValidatedConfig(Options?)`: Same as `loadConfig`, without changing `config` export.

`loadUnvalidatedConfig(Options?)`: Same as `loadValidatedConfig`, but does not check schema.

`loadSchema(Options?)`: Reads schema file.

`loadMetaConfig(Options?)`: Reads meta file.

`setLogLevel(LogLevel)`: Changes the internal logging level.

`currentEnvironment(EnvironmentAliases?)`: Returns the current (canonical) environment, which is used for `$env` and others.

`defaultAliases`: Aliases that we apply by default. Currently, these are `dev` -> `development` and `prod` -> `production`.

`ParsedValue` (*internal*) : Structure of parsed config trees, which contains metadata like where each value came from.

`ConfigSource` (*internal*) : Abstract class for reading configuration.

`FileSource` (*internal*) : Reading configuration from a file.

`FlexibleFileSource` (*internal*) : Reading configuration from a variety of paths, looking for one that exists.

`EnvironmentSource` (*internal*) : Reading configuration from an environment variable.

`LiteralSource` (*internal*) : Reading configuration from a JavaScript object.

`CombinedSource` (*internal*) : Reading configuration from multiple sources that are merged.

`FallbackSource` (*internal*) : Reading configuration from the first of multiple sources that can be found.

`FileType` (*internal*) : Enum of supported file formats.

`filePathAssumedType(string)` (*internal*) : Converts a filepath to a FileType based on it's extension.

`stringify(object, FileType)` (*internal*) : Stringifies a raw object as a specific file format.

`parseRawString(string, FileType)` (*internal*) : Internal parsing function that knows all file types.
