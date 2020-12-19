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

replace_version_references() {
  sed -i "s#[\"]@lcdev\\/app-config[\"]: [\"]$PREV_VERSION[\"]#\"@lcdev\\/app-config\": \"$VERSION\"#g" $@
  sed -i "s#[\"]@lcdev\\/app-config[\"]: [\"]2 || $PREV_VERSION[\"]#\"@lcdev\\/app-config\": \"2 || $VERSION\"#g" $@
  sed -i "s#[\"]@lcdev\\/app-config[\"]: [\"]1 || 2 || $PREV_VERSION[\"]#\"@lcdev\\/app-config\": \"1 || 2 || $VERSION\"#g" $@

  sed -i "s#[\"]@lcdev\\/app-config-webpack-plugin[\"]: [\"]$PREV_VERSION[\"]#\"@lcdev\\/app-config-webpack-plugin\": \"$VERSION\"#g" $@
  sed -i "s#[\"]@lcdev\\/app-config-inject[\"]: [\"]$PREV_VERSION[\"]#\"@lcdev\\/app-config-inject\": \"$VERSION\"#g" $@
  sed -i "s#[\"]@lcdev\\/react-native-app-config-transformer[\"]: [\"]$PREV_VERSION[\"]#\"@lcdev\\/react-native-app-config-transformer\": \"$VERSION\"#g" $@

  git add $@
}

new_version ./app-config
new_version ./app-config-webpack-plugin
new_version ./app-config-inject
new_version ./app-config-react-native-transformer

replace_version_references ./app-config-webpack-plugin/package.json
replace_version_references ./app-config-inject/package.json
replace_version_references ./app-config-react-native-transformer/package.json
replace_version_references ./examples/*/package.json

git commit -m "chore: release v$VERSION"
git tag v$VERSION
