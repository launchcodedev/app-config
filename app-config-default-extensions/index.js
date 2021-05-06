// NOTE: This module "breaks" the circular dependency between different packages.
// By not being a TypeScript project with project references, we can use this
// tiny module as a glue between @app-config/node and @app-config/* extensions.

const {
  unescape$Directives,
  tryDirective,
  ifDirective,
  eqDirective,
  parseDirective,
  hiddenDirective,
  envDirective,
  envVarDirective,
  extendsDirective,
  extendsSelfDirective,
  overrideDirective,
  timestampDirective,
  substituteDirective,
} = require('@app-config/extensions');

module.exports = {
  defaultExtensions() {
    return [
      unescape$Directives(),
      tryDirective(),
      ifDirective(),
      eqDirective(),
      parseDirective(),
      hiddenDirective(),
      envDirective(),
      envVarDirective(),
      extendsDirective(),
      extendsSelfDirective(),
      overrideDirective(),
      timestampDirective(),
      substituteDirective(),
    ];
  },
  defaultEnvExtensions() {
    return [unescape$Directives(), markAllValuesAsSecret()];
  },
  defaultMetaExtensions() {
    return [
      unescape$Directives(),
      tryDirective(),
      ifDirective(),
      eqDirective(),
      hiddenDirective(),
      extendsDirective(),
      extendsSelfDirective(),
      overrideDirective(),
    ];
  },
};
