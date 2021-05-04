---
title: Parsing Extensions
---

## What is a Parsing Extension?

Since v2, App Config has a built-in abstraction for parsing files in special ways.
We call these parsing extensions because they change the way that values themselves are parsed.
There are default extensions, but even these can be disabled if need be.

Generally, the answer to the question is that extensions are "value transformers".
App Config visits every property of parsed config files and asks each extension if anything should be done to it.

## The `$env` Directive

Selects values based on the current `APP_CONFIG_ENV`, `NODE_ENV` or `ENV` (in that order).
Falls back to the `default` key if there is no current environment, or if a value for it is not present.

```yaml
apiUrl:
  $env:
    default: 'http://localhost:3000'
    qa: 'https://qa.app.example.com'
    staging: 'https://staging.app.example.com'
    production: 'https://app.example.com'
```

This structure is flattened. The example above would resolve (with no environment) to:

```yaml
apiUrl: 'http://localhost:3000'
```

If `$env` values are objects, they can be merged.

```yaml
api:
  $env:
    dev:
      url: 'http://localhost:3000'
    qa:
      url: 'https://qa.app.example.com'

  timeout: 5000
```

This will safely resolve to an object `{ url: string, timeout: number }` by merging sibling keys.

Note that `$env` is aware of environment name aliases as well. See [meta file](./settings.md#parse-and-loading-configuration)
for how to change the environmentSourceNames or environmentAliases.

## The `$extends` Directive

Merges (deeply) values from another file. The current file has precedent when merging.

```yaml
# Use it with a file path
$extends: './other-file.yml'

# Or use it with options
nested:
  propertyA:
    $extends:
      path: ./other-file.yml
      optional: true
      select: 'foo.bar'

# An array also works
$extends:
  - ./file1.yml
  - ./file2.yml
```

This option can be given a filepath, an object with options, or an array of objects.

`select` allows extending a property from the other file, and `optional` allows missing files.

To read another file with a different environment, simply use the `env` option:

```yaml
$extends:
  path: ./other-file.yml
  env: staging
```

This will load the file as if you were in `staging`, even though the current environment might be something else.

## The `$override` Directive

The override directive is exactly the same as `$extends`, except that the other file takes precedent when merging.
This is useful for the pattern:

```yaml
# if present, the values in this file will override the ones here
$override:
  path: /etc/my-app/config.yml
  optional: true

# ... default values
```

## The `$envVar` Directive

Pulls in an environment variable.

```yaml
username:
  $envVar: USER

hostname:
  $envVar:
    name: HOSTNAME
    allowNull: true
```

Use `parseInt`, `parseFloat` or `parseBool` option alongside the name to parse values from the env string.

## The `$substitute` Directive

Allows environment variables to be used in strings. Very similar to `$envVar`, but allows embedding variables in strings.

```yaml
apiUrl:
  $env:
    dev: { $substitute: 'http://${MY_IP:-localhost}:3000' }
    qa: 'https://qa.app.example.com'

username: { $substitute: '$USER' }
```

Works essentially the same way as [bash variable substitution](https://tldp.org/LDP/abs/html/parameter-substitution.html)
(including fallback syntax).

The other form of substitution is via `name`:

```yaml
username:
  $substitute:
    # Look for $USER, use 'no-user' as fallback value
    name: 'USER'
    fallback: 'no-user'
```

Use `allowNull: true` if your fallback is allowed to be nullable.

## Decryption

Values that are encrypted will automatically be decrypted.
These values come in the form of `enc:{revision}:{base64}`.
Because this string format is unique, App Config can guarantee that it's not a plain string value.

The user will be required to unlock their keychain if the secret-agent isn't running.

```yaml
password: 'enc:1:wy4ECQMI/o7E3nw9SP7g3VsIMg64HGIcRb9HyaXpQnyjozFItwx4HvsP1D2plP6Y0kYBAr2ytzs2v5bN+n2oVthkEmbrq8oqIqCF3Cx+pcjJ+5h+SyxQuJ7neNp4SRtnD4EK32rPJpyDMeHG4+pGwIjFuSH1USqQ=SZWR'
```

## The `$if` and `$try` Directives

Performs basic control flow.

```yaml
$try:
  $value:
    $extends: ./other-file.yml
  $fallback: {}
```

Use `$unsafe: true` if you want to catch _any_ error. Some "safe" errors are caught by default.

```yaml
$if:
  $check: true
  $then: foo
  $else: bar
```

The `$if` directive is straightforward, see the example.

## The `$eq` Directive

Checks if two values are equal (using deep equality).

```yaml
$if:
  $check:
    $eq:
      - 42
      - 42
  $then: foo
  $else: bar
```

## The `$hidden` Directive

You can use `$hidden` anywhere - the values underneath it are not processed directly.
This is useful for shared values.

```yaml
$hidden:
  foo: 42

bar:
  baz:
    $extendsSelf: '$hidden.foo'

qux:
  $extendsSelf: '$hidden.foo'
```

This results in `{ bar: { baz: 42 }, qux: 42 }`.

## The `$timestamp` Directive

Allows injecting the current date and time into configuration. While this option is useful,
it does of course come at the cost of non-determinism.

```yaml
buildDate:
  $timestamp: true
```

By default, this will resolve as `buildDate: new Date().toISOString()`. Options can also be passed to `toLocaleDateString()`.

```yaml
buildDate:
  $timestamp:
    locale: en-US
    weekday: long
    year: numeric
    month: long
    day: numeric
```

Note that the time here is entirely determined by when App Config runs. That might
be deploy time, it might be build time, or it might be run time.

## The `$git` Directive

To retrieve the current git revision or branch name, use the `$git` directive.
Do note that this means your config is not deterministic.

```yaml
builtRevision:
  $git: commit # use this for the full length commit hash
  $git: commitShort # use this for the short commit hash
  $git: branch # use this for the current branch name
```

Note that this directive _will not fail_ if git status is not clean.

## Custom Extensions

It's not all too difficult to make your own!

```typescript
import { loadConfig, defaultExtensions, ParsingExtension } from '@app-config/main';

const uppercaseExtension: ParsingExtension = (value, [_, key]) => {
  if (key === '$uppercase') {
    return (parse) => parse(value.toUpperCase());
  }

  return false;
};

const config = await loadConfig({
  parsingExtensions: defaultExtensions().concat(uppercaseExtension),
});
```

In essence, every parsing extension is called for every value that's seen in configuration.
That includes every primitive value, all object keys, and array iteration.
This process is top-down, which you might not expect. That means that visitors are called
on root-level properties first, and descends recursively. Extensions descend via opt-in (the `parse` function).

App Config uses the same public interface for its built-in extensions, so if you're looking for examples
there are a few in the codebase.

We'd like to document this more. Custom resolvers and value transformations have a lot of potential.

## Loading Custom Extensions

App Config will look at the meta file for "extra" parsing extensions to use.

For example:

```yaml
parsingExtensions:
  - '@app-config/vault'
```

You can pass options to the extensions as well, by making array items objects.

```yaml
parsingExtensions:
  - name: '@app-config/vault'
    options:
      address: 'http://localhost:8200'
```

These parsing extensions are used for loading config files and secret files.
They do not take effect when parsing `$APP_CONFIG`.
