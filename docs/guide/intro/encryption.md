---
title: Value Encryption
---

## Project Setup

We've tried to make using encrypted secrets as easy as it possibly can be.

```sh
# this initializes your machine-local keychain
# this is global to your system, stored in your home folder
npx @app-config/cli secret init

# this initializes a specific repository's encryption keys
# any new repository will have different encryption keys
npx @app-config/cli secret init-repo
```

::: tip Important!
Encrypted values are per-meta-file. Encryption is context sensitive, **not** global.
:::

From here, you can encrypt and decrypt values.

```sh
npx @app-config/cli secret encrypt 42
npx @app-config/cli secret encrypt null
npx @app-config/cli secret encrypt 'SuperSecret'
```

You can use the outputted (encrypted) values anywhere in your app-config files.
Values are placed in configuration files as base64 strings, like this:

```yaml
database:
  user: my_service
  password: 'enc:1:wy4ECQMI/o7E3nw9SP7g3VsIMg64HGIcRb9HyaXpQnyjozFItwx4HvsP1D2plP6Y0kYBAr2ytzs2v5bN+n2oVthkEmbrq8oqIqCF3Cx+pcjJ+5h+SyxQuJ7neNp4SRtnD4EK32rPJpyDMeHG4+pGwIjFuSH1USqQ=SZWR'
```

Note that the CLI also has many useful shortcuts.

```sh
npx @app-config/cli secret encrypt --clipboard 42
npx @app-config/cli secret decrypt 'enc:1:...'
```

Both commands support stdin input, and have options to read/write from the system clipboard.

## Secret Agent

It would be impractical to enter your password every time you want to run your app.

```
npx @app-config/cli secret agent
```

This command starts a daemon process, which runs a local server on your machine.
Any program that has localhost access can access it, so be wary of running this on
a multi-tenant machine.

When this server is detected, App Config can use it to encrypt and decrypt values.
That means that you can run a `node-dev`, `nodemon`, etc. process without having constant passphrase prompts.

If you want to opt-out of using the secret agent, the CLI has a `--agent=false` flag.

## Trusting Users

If you're already trusted, ask the other user to run this command:

```sh
npx @app-config/cli secret export ./my-key
```

This writes a `my-key` file with their public key. Have them give you this file, so you can import it.

```sh
npx @app-config/cli secret trust ./my-key
```

This will re-sign all encryption keys of the current repository with their public
key. This gives them access to any previously encrypted secrets as well.

To specify an encryption environment to trust the user on, set the standard App-Config environment variables (`ENV`, `NODE_ENV`, or `APP_CONFIG_ENV`).
If no environment is specified, the user will be trusted on the `default` environment.

## Untrusting Users

You can untrust users as well. Please rotate secrets if they are a security concern.
Once a user has read secrets, there's no way to _truly_ revoke that access.

```sh
npx @app-config/cli secret untrust somebody@example.com
```

This does not require re-encrypting any secrets. Any new encrypted values will use a
new key that `somebody@example.com` never had access to.

To specify an encryption environment to untrust the user on, set the standard App-Config environment variables (`ENV`, `NODE_ENV`, or `APP_CONFIG_ENV`).
If no environment is specified, the user will be untrusted on the `default` environment.

To completely untrust a user from your project you must untrust them from all encryption environments they were trusted on.

::: warning
While the above is true, be wary of how the timeline of events interacts with version control.
:::

## CI / Automation

The CLI subcommand `app-config secret ci` can create an artificial team member for CI environments.
These keys are like any other team member, but are not protected with a passphrase.
This key (public + private) can be added as protected environment variables in your CI provider:

- `APP_CONFIG_SECRETS_KEY`
- `APP_CONFIG_SECRETS_PUBLIC_KEY`

Or, in files referenced by:

- `APP_CONFIG_SECRETS_KEY_FILE`
- `APP_CONFIG_SECRETS_PUBLIC_KEY_FILE`

The CLI will output both of these with instructions.

To use different keys for different secret environments suffix the environment variable names with the name of the environment.
For example - to specify the keys that will be used in an environment called `production` use these environment variables:

- `APP_CONFIG_SECRETS_KEY_PRODUCTION`
- `APP_CONFIG_SECRETS_PUBLIC_KEY_PRODUCTION`

## Implementation Details

- We store a list of team members public keys per encryption environment in meta files
- We store a list of 'encryptionKeys' (symmetric keys) per encryption environment in meta files
  - Keys are symmetric, but are themselves stored in encrypted form (encrypted by team members' public keys, which allows any team member to decrypt it)
  - Once the key is given to somebody, they can always decrypt secrets that were encrypted with it
  - Keys have 'revision' numbers, so we can use the latest one (revision is embedded into the password itself, to prevent tampering in the YAML)
  - The encryption environment is included in the revision to determine which symmetric key set to use to decrypt the secret
  - By keeping revisions, we can untrust a user without having to re-encrypt every secret made before
    - You'd likely still want to rotate most passwords, but doing so automatically (dumping out YAML files everywhere) would be extremely difficult to do right
    - The secrets are already compromised, so manual intervention is needed regardless
- Values are encrypted using the CLI
  - They come in the form `enc:{revision}:{base64}`
  - They store which key revision was used to encrypt them
- Values can be put anywhere in config files, and are detected and parsed automatically
- Rotating keys can be done with the `init-key` CLI subcommand, or when untrusting a user
  - Untrusting requires encrypting all future secrets with a new key
- Adding a user just re-encrypts all previous key revisions with the new team members list, giving access to previously made secrets
- The secret agent is passed encrypted secrets, and the encrypted key that should be used to decrypt it
  - The decrypted secret is sent back, using a unique ID to identify it (meaning multiple secrets can be decrypted at once)

## Security

We rely heavily on OpenPGP. No sensitive operations are performed directly by App Config.

## Configuration

App Config will set up your keychain in the standard config file location on your machine.
If you really need to, you can set `APP_CONFIG_SECRETS_KEYCHAIN_FOLDER` to override this.

Check out the [settings](./settings.md) section for more.

## Multiple Devices

If you have many computers, all of which using the same email address in their encryption keys,
a `keyName` property can be used. This property is kept when App Config makes changes to the meta file.
It serves no logical roles, it's simply there as metadata for you to identify which key is which.

<h4 style="text-align:center">.app-config.meta.yml</h4>

```yaml
teamMembers:
  default:
    - userId: Joel Gallant <joel@joelgallant.io>
      keyName: Desktop
      publicKey: '...'
    - userId: Joel Gallant <joel@joelgallant.io>
      keyName: Laptop
      publicKey: '...'
encryptionKeys:
  default:
    - revision: 1
      key: '...'
```

## Multiple Environments

It can be useful to have different levels of trust on the same repository. For example, it may make sense for your project to have fewer people able to decrypt the secrets used on production then the secrets for a QA environment.

To add secret environments to an existing project just move your existing `teamMembers` and `encryptionKeys` values under a `default` property.

For example:

```yaml
teamMembers:
  - userId: Joel Gallant <joel@joelgallant.io>
    keyName: Desktop
    publicKey: '...'
  - userId: Joel Gallant <joel@joelgallant.io>
    keyName: Laptop
    publicKey: '...'
encryptionKeys:
  - revision: 1
    key: '...'
```

Becomes

```yaml
teamMembers:
  default:
    - userId: Joel Gallant <joel@joelgallant.io>
      keyName: Desktop
      publicKey: '...'
    - userId: Joel Gallant <joel@joelgallant.io>
      keyName: Laptop
      publicKey: '...'
encryptionKeys:
  default:
    - revision: 1
      key: '...'
```

To create a new encryption environment use the `init-repo` CLI subcommand while setting one of the standard App-Config environment variables (`ENV`, `NODE_ENV`, or `APP_CONFIG_ENV`) with the new encryption environment. You can then use the normal App Config secret CLI commands while specifying the environment to trust and untrust users and encrypt and decrypt secrets for that specific environment.

It's also possible to reuse encryption keys across environments since App Config secret environments and config environments are not linked. For example, you may have 3 config environments like prod, QA, and staging but only 2 encryption environments prod and QA. The production environment likely has more strict access requirements than staging and QA which may have the same users trusted on them. This allows you to trust a user once on the shared QA/staging encryption environment which will allow them to decrypt secrets used on staging and QA.
