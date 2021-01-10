## App Config Vault Plugin

```yaml
$vault:
  secret: 'foo'
  select: 'bar'
```

This is like, in the CLI:

```sh
vault kv get -format=json secret/foo | jq .data.data.bar
```

Meaning, it looks up the "secret/foo", and selects the value in "bar".

## Usage

Install and use:

```sh
yarn add @app-config/vault
```

In `.app-config.meta.yml` file:

```yaml
parsingExtensions:
  - '@app-config/vault'
```

Options look like this:

```yaml
parsingExtensions:
  - name: '@app-config/vault'
    options:
      address: 'http://localhost:8200' // read from VAULT_ADDR if not set
      token: '...' // read from VAULT_TOKEN if not set
      namespace: '...' // optional, read from VAULT_NAMESPACE
```
