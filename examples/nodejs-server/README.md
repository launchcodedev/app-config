## Node.js Example Project with Encryption

### Installation
Start by installing dependancies
```sh
yarn
```
Next if you haven't done so already, initialize your local keychain 
```sh
yarn app-config secret init
```
In order to trust yourself to this project, you can export your public certificate by running
```
yarn app-config secrets export my_public_key.asc
```
In order to trust yourself to this project run [more on trusting users](https://app-config.netlify.app/guide/intro/encryption.html#trusting-users)
```sh
yarn trust my_public_key.asc
```
You are now a trusted member of this project and can view its secrets. (Note: .app-config.meta.yml has changed with the new trusted user). 

To view all config variables including secrets you can run
```sh
yarn app-config vars --secrets
```
alternatively, you can decrypt a secret by running 
```sh
yarn app-config secret decrypt 'enc:1:...'
```
 