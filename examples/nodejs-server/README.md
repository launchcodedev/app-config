## Node.js Example Project

See the [guide](https://app-config.dev/guide/node/) for more info.

This project demonstrates using a config files to change a Node.js server.

### Usage

```sh
yarn install
```

If you haven't done so already, initialize your local keychain by running:

```sh
yarn app-config secrets init
```

In order to trust yourself to this project, you can export your public certificate by running:
In order to trust yourself in this project, run:

```
yarn app-config secrets export my_public_key.asc

APP_CONFIG_SECRETS_KEY=`cat ci.asc` yarn app-config secrets trust my_public_key.asc && rm ./my_public_key.asc
```

More on trusting users [here](https://app-config.dev/guide/intro/encryption.html#trusting-users).

**NOTE:**
We're using the variable `APP_CONFIG_SECRETS_KEY` in order to authorize your key in this repo.
[More info here](https://app-config.dev/guide/intro/encryption.html#ci-automation).

---

You are now a trusted member of this project and can view its secrets.

To view all config variables including secrets, you can run:

```sh
yarn app-config vars --secrets
```

Alternatively, you can decrypt a secret by running:

```sh
yarn app-config secrets decrypt 'enc:1:...'
```
