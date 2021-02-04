#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

if [ "$#" == "0" ]; then
  printf "No version given\n"
  exit 1
fi

VERSION=$1
PREV_VERSION=$(cat ./app-config/package.json | jq -r .version)

if [ -n "$(git status --porcelain)" ]; then
  printf "Git status is not clean\n"
  exit 2
fi

if [ "$VERSION" == "$PREV_VERSION" ]; then
  printf "Same version as before\n"
  exit 3
fi

printf "Version $PREV_VERSION -> $VERSION\n"

new_version() {
  local prev=$(pwd)
  cd $1
  yarn version --new-version $VERSION --no-git-tag-version
  git add ./package.json
  cd $prev
}

new_version ./app-config-core
new_version ./app-config-node
new_version ./app-config-cli
new_version ./app-config
new_version ./app-config-webpack-plugin
new_version ./app-config-inject
new_version ./app-config-vault
new_version ./app-config-cypress
new_version ./app-config-react-native-transformer

git commit -m "chore: release v$VERSION"
git tag v$VERSION
