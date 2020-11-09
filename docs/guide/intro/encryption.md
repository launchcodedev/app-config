---
title: Encryption
---

## Project Setup
We've tried to make using encrypted secrets as easy as it possibly can be.

```sh
# this initializes your user, which is global to your system (stored in home folder)
npx app-config secret init

# this initializes a repository's encryption keys
npx app-config secret init-repo
```

From here, it should be all set up.

```sh
npx app-config secret encrypt 42
npx app-config secret encrypt null
npx app-config secret encrypt 'SuperSecret'
```

You can use the outputted (encrypted) values anywhere in your app-config files.

## Trusting Users
If you're already trusted, ask the other user to:

```sh
npx app-config secret export ./my-key
```

Have them give you the 'my-key' file.

```sh
npx app-config secret trust ./my-key
```

This will re-sign all encryption keys with their public key as well, giving them access to any previously encrypted secrets.

You can untrust users as well. Please rotate secrets if they are a security concern.

```sh
npx app-config secret untrust somebody@example.com
```

## Core Concepts
- We store team members public keys in app-config meta files
- We store a list of 'encryptionKeys' in app-config meta files
  - Keys are symmetric, but are themselves stored in encrypted form (encrypted with team members public keys, which allows any of the team members to decrypt it)
  - Once the key is given to somebody, they can always decrypt secrets that were encrypted with it
  - Keys have 'revision' numbers, so we can use the latest one (revision is embedded into the password itself, to prevent tampering in the YAML)
  - By keeping revisions of keys, we can untrust a user without having to re-encrypt every secret made before
    - You'd likely still want to rotate most passwords, but doing so automatically (dumping out YAML files everywhere) would be extremely difficult to do right
    - The secrets are already compromised, so manual intervention is needed regardless
- Values are encrypted using the app-config CLI
  - They come in the form 'enc:{}:...'
  - They store which key revision was used to encrypt them
- Values can be put anywhere in app-config files, and are detected and parsed automatically
- Rotating keys can be done with 'init-key' CLI, or when untrusting a user
  - Untrusting requires encrypting all future secrets with a new key
- Adding a user just re-encrypts all previous key revisions with the new team members list, giving access to previously made secrets
- The secret agent is passed encrypted secrets, and the encrypted key that should be used to decrypt it
  - The decrypted secret is sent back, using a unique ID to identify it (meaning multiple secrets can be decrypted at once)

## Security
We rely heavily on OpenPGP.
