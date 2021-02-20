#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

if [ "$#" == "0" ]; then
  printf "No package name given\n"
  exit 1
fi

echo -n "Description: "
read PACKAGE_DESCRIPTION

NAME=$1
PACKAGE_NAME=app-config-$NAME
PACKAGE_VERSION=$(jq -r ".version" ./app-config-main/package.json)

PACKAGE_JSON=$(printf '{
  "name": "@app-config/%s",
  "description": "%s",
  "version": "%s",
  "license": "MPL-2.0",
  "author": {
    "name": "Launchcode",
    "email": "admin@lc.dev",
    "url": "https://lc.dev"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/launchcodedev/app-config.git"
  },
  "main": "dist/index.js",
  "module": "dist/es/index.js",
  "types": "dist/index.d.ts",
  "files": [
    "/dist",
    "!**/*.tsbuildinfo",
    "!**/*.test.*"
  ],
  "scripts": {
    "build": "tsc -b",
    "build:es": "tsc -b tsconfig.es.json",
    "clean": "rm -rf dist *.tsbuildinfo",
    "lint": "eslint src",
    "fix": "eslint --fix src",
    "test": "jest",
    "prepublishOnly": "yarn clean && yarn build && yarn build:es"
  },
  "dependencies": {
  },
  "devDependencies": {
  },
  "prettier": "@lcdev/prettier",
  "jest": {
    "preset": "@lcdev/jest"
  }
}' $NAME $PACKAGE_DESCRIPTION $PACKAGE_VERSION)

TSCONFIG='{
  "extends": "@lcdev/tsconfig",
  "compilerOptions": {
    "rootDir": "./src",
    "outDir": "./dist"
  },
  "include": ["src"],
  "exclude": ["node_modules"],
  "references": [
    { "path": "../app-config-test-utils" }
  ]
}'

echo "-- Creating ./$PACKAGE_NAME"
mkdir -p ./$PACKAGE_NAME

echo "  -- Creating ./package.json"
echo "$PACKAGE_JSON" > $PACKAGE_NAME/package.json
npx prettier -w $PACKAGE_NAME/package.json

echo "  -- Creating ./.eslintrc.js"
cp ./app-config-main/.eslintrc.js ./$PACKAGE_NAME/.eslintrc.js

echo "  -- Creating ./tsconfig.json"
echo "$TSCONFIG" > $PACKAGE_NAME/tsconfig.json

echo "  -- Creating ./tsconfig.es.json"
cp ./app-config-main/tsconfig.es.json ./$PACKAGE_NAME/tsconfig.es.json

echo "  -- Creating ./README.md"
touch ./$PACKAGE_NAME/README.md

echo "  -- Creating ./src/index.ts"
mkdir ./$PACKAGE_NAME/src
touch ./$PACKAGE_NAME/src/index.ts

yarn install
