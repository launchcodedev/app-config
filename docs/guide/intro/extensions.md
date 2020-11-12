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

Can be given a string (filepath), or object with options (`select` allows
extending from a nested property, `optional` allows for the file to be missing).

## The `$override` Directive

Exactly the same as `$extends` except the other file has precedent when merging.

## The `$substitute` Directive

Allows environment variables to be used in strings.

```yaml
apiUrl:
  $env:
    dev: { $substitute: 'http://${MY_IP:-localhost}:3000' }
    qa: 'https://qa.app.example.com'

username: { $substitute: '$USER' }
```

Works essentially the same way as bash variable substitution (including fallback syntax).

## Decryption

Values that are encrypted will automatically be decrypted. These values come in
the form of `enc:1:...` (... being a base64 encoded string).

```yaml
password: 'enc:1:wy4ECQMI/o7E3nw9SP7g3VsIMg64HGIcRb9HyaXpQnyjozFItwx4HvsP1D2plP6Y0kYBAr2ytzs2v5bN+n2oVthkEmbrq8oqIqCF3Cx+pcjJ+5h+SyxQuJ7neNp4SRtnD4EK32rPJpyDMeHG4+pGwIjFuSH1USqQ=SZWR'
```
