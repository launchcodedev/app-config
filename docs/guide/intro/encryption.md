---
title: Value Encryption
---

## Project Setup

We've tried to make using encrypted secrets as easy as it possibly can be.

```sh
# this initializes your machine-local keychain
# this is global to your system, stored in your home folder
npx app-config secret init

# this initializes a specific repository's encryption keys
# any new repository will have different encryption keys
npx app-config secret init-repo
```

::: tip Important!
Encrypted values are per-meta-file. Encryption is context sensitive, **not** global.
:::

From here, you can encrypt and decrypt values.

```sh
npx app-config secret encrypt 42
npx app-config secret encrypt null
npx app-config secret encrypt 'SuperSecret'
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
npx app-config secret encrypt --clipboard 42
npx app-config secret decrypt 'enc:1:...'
```

Both commands support stdin input, and have options to read/write from the system clipboard.

## Secret Agent

It would be impractical to enter your password every time you want to run your app.

```
npx app-config secret agent
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
npx app-config secret export ./my-key
```

This writes a `my-key` file with their public key. Have them give you this file, so you can import it.

```sh
npx app-config secret trust ./my-key
```

This will re-sign all encryption keys of the current repository with their public
key. This gives them access to any previously encrypted secrets as well.

## Untrusting Users

You can untrust users as well. Please rotate secrets if they are a security concern.
Once a user has read secrets, there's no way to _truly_ revoke that access.

```sh
npx app-config secret untrust somebody@example.com
```

This does not require re-encrypting any secrets. Any new encrypted values will use a
new key that `somebody@example.com` never had access to.

::: warning
While the above is true, be wary of how the timeline of events interacts with version control.
:::

## CI / Automation

The CLI subcommand `app-config secret ci` can create an artificial team member for CI environments.
These keys are like any other team member, but are not protected with a passphrase.
This key (public + private) can be added as protected environment variables in your CI provider:

- `APP_CONFIG_SECRETS_KEY`
- `APP_CONFIG_SECRETS_PUBLIC_KEY`

The CLI will output both of these with instructions.

## Implementation Details

- We store a list of team members public keys in meta files
- We store a list of 'encryptionKeys' (symmetric keys) in meta files
  - Keys are symmetric, but are themselves stored in encrypted form (encrypted by team members' public keys, which allows any team member to decrypt it)
  - Once the key is given to somebody, they can always decrypt secrets that were encrypted with it
  - Keys have 'revision' numbers, so we can use the latest one (revision is embedded into the password itself, to prevent tampering in the YAML)
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
