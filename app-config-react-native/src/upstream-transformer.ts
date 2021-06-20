/* eslint-disable import/extensions */
/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable import/no-unresolved */
/* eslint-disable global-require */
import { parse } from 'semver';
import { version as reactNativeVersionString } from 'react-native/package.json';

if (!reactNativeVersionString) {
  throw new Error(
    'Cannot detect React Native version. Module react-native package.json missing version',
  );
}

export type TransformOptions = {
  src: string;
  filename: string;
  options: {
    customTransformOptions: {
      [key: string]: any;
    };
    dev: boolean;
    hot: boolean;
    inlinePlatform: boolean;
    minify: boolean;
    platform: string;
    experimentalImportSupport: boolean;
    type: string;
    inlineRequires: boolean;
    enableBabelRCLookup: boolean;
    enableBabelRuntime: boolean;
    projectRoot: string;
    publicPath: string;
  };
};

export type Transformer = {
  transform(options: TransformOptions): void;
};

export type LegacyTransformer = {
  transform(src: string, filename: string, options: any): void;
};

let transformer: Transformer;

const reactNativeMinorVersion = parse(reactNativeVersionString)?.minor;

if (!reactNativeMinorVersion) {
  throw new Error(
    `Failed to parse minor version from React Native version '${reactNativeVersionString}'`,
  );
}

if (reactNativeMinorVersion >= 59) {
  transformer = require('metro-react-native-babel-transformer') as Transformer;
} else if (reactNativeMinorVersion >= 56) {
  transformer = require('metro/src/reactNativeTransformer') as Transformer;
} else if (reactNativeMinorVersion >= 52) {
  transformer = require('metro/src/transformer') as Transformer;
} else if (reactNativeMinorVersion >= 47) {
  transformer = require('metro-bundler/src/transformer') as Transformer;
} else if (reactNativeMinorVersion === 46) {
  transformer = require('metro-bundler/build/transformer') as Transformer;
} else {
  // handle RN <= 0.45
  const legacyUpstreamTransformer =
    require('react-native/packager/transformer') as LegacyTransformer;
  transformer = {
    transform({ src, filename, options }: TransformOptions) {
      return legacyUpstreamTransformer.transform(src, filename, options);
    },
  };
}

export const upstreamTransformer = transformer;
