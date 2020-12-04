## CLI Example Project

See the [guide](https://app-config.dev/guide/node/) for more info.

This project demonstrates using a central location for config files, with a custom file name.

### Usage

```sh
yarn install

yarn build

# write a config file for our CLI to read
echo '{ user: { name: "Me!" } }' > ~/.config/my-cli.json5

# Runs the CLI
yarn start
```
