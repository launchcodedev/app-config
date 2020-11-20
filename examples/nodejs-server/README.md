## Node.js Example Project with Encryption

### Installation
Start by installing dependencies:
```sh
yarn install
```

Next if you haven't done so already, initialize your local keychain by running:
```sh
yarn app-config secret init
```

In order to trust yourself to this project, you can export your public certificate by running:
```
yarn app-config secrets export my_public_key.asc
```

In order to trust yourself to this project run: [more on trusting users](../../guide/intro/encryption.md#trusting-users)
```sh
yarn APP_CONFIG_SECRETS_KEY=`cat ci.asc` app-config secret trust my_public_key.asc
```
---
**NOTE:**
using the env variable APP_CONFIG_SECRETS_KEY in order to authorize your private key to this repo. [For more info on how CI works](../../guide/intro/encryption.md#ci-automation)

---

You are now a trusted member of this project and can view its secrets. (Note: .app-config.meta.yml has changed with the new trusted user). 

To view all config variables including secrets you can run:
```sh
yarn app-config vars --secrets
```

alternatively, you can decrypt a secret by running:
```sh
yarn app-config secret decrypt 'enc:1:...'
```
