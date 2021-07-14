#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

if [ "$#" == "0" ]; then
  printf "No version given\n"
  exit 1
fi

VERSION=$1
PREV_VERSION=$(cat ./app-config-main/package.json | jq -r .version)

if [ -n "$(git status --porcelain)" ]; then
  printf "Git status is not clean\n"
  # exit 2
fi

if [ "$VERSION" == "$PREV_VERSION" ]; then
  printf "Same version as before\n"
  exit 3
fi

printf "Version $PREV_VERSION -> $VERSION\n"

replace_version_references() {
  sed -i "s#\([\"]@app-config\\/[a-z-]*[\"]: [\"]\)\\^$PREV_VERSION[\"]#\\1^$VERSION\"#g" $@
  sed -i "s#\([\"]@lcdev\\/app-config-[a-z-]*[\"]: [\"]\)\\^$PREV_VERSION[\"]#\\1^$VERSION\"#g" $@
  git add $@
}

new_version() {
  local prev=$(pwd)
  cd $1
  yarn version --new-version $VERSION --no-git-tag-version
  git add ./package.json
  replace_version_references $(realpath ./package.json)
  cd $prev
}

new_version app-config-cli
new_version app-config-config
new_version app-config-core
new_version app-config-cypress
new_version app-config-default-extensions
new_version app-config-electron
new_version app-config-encryption
new_version app-config-exec
new_version app-config-extension-utils
new_version app-config-extensions
new_version app-config-generate
new_version app-config-git
new_version app-config-inject
new_version app-config-js
new_version app-config-logging
new_version app-config-main
new_version app-config-meta
new_version app-config-node
new_version app-config-react-native
new_version app-config-schema
new_version app-config-settings
new_version app-config-test-utils
new_version app-config-utils
new_version app-config-v1-compat
new_version app-config-vault
new_version app-config-webpack
new_version app-config-rollup
new_version app-config-vite
new_version lcdev-app-config
new_version lcdev-app-config-inject
new_version lcdev-app-config-webpack-plugin
new_version lcdev-react-native-app-config-transformer

git commit -m "chore: release v$VERSION"
git tag v$VERSION
