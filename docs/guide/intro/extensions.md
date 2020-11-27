---
title: Parsing Extensions
---

## The `$env` Directive

Selects values based on the current `APP_CONFIG_ENV`, `NODE_ENV` or `ENV` (in that order).
Falls back to the `default` key if env is undefined, or value for current env is not present.

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

## The `$extends` Directive

Merges (deeply) values from another file. Current file has precedent when merging.

```yaml
$extends: './other-file.yml'

nested:
  property:
    $extends:
      path: ./other-file.yml
      optional: true
      select: 'foo.bar'
```

This option can be given a string (filepath), an object with options, or an array of objects.
`select` allows extending a specific nested value, and `optional` allows for the file to be missing.

## The `$override` Directive

Exactly the same as `$extends` except that the other file has precedent when merging.

## The `$substitute` Directive

Allows environment variables to be used in strings.

```yaml
apiUrl:
  $env:
    dev: { $substitute: 'http://${MY_IP:-localhost}:3000' }
    qa: 'https://qa.app.example.com'

username: { $substitute: '$USER' }
```

Works essentially the same way as [bash variable substitution](https://tldp.org/LDP/abs/html/parameter-substitution.html)
(including fallback syntax).

## Decryption

Values that are encrypted will automatically be decrypted. These values come in
the form of `enc:{revision}:{base64}`. The user will be required to unlock their
keychain if the secret-agent isn't running.

```yaml
password: 'enc:1:wy4ECQMI/o7E3nw9SP7g3VsIMg64HGIcRb9HyaXpQnyjozFItwx4HvsP1D2plP6Y0kYBAr2ytzs2v5bN+n2oVthkEmbrq8oqIqCF3Cx+pcjJ+5h+SyxQuJ7neNp4SRtnD4EK32rPJpyDMeHG4+pGwIjFuSH1USqQ=SZWR'
```
