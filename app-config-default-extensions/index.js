// NOTE: This module "breaks" the circular dependency between different packages.
// By not being a TypeScript project with project references, we can use this
// tiny module as a glue between @app-config/node and @app-config/* extensions.

// NOTE: Also, we don't require modules up-front - lazy load them instead.
// This avoids circular dependency chains.
const { defaultAliases } = require('@app-config/node');

module.exports = {
  defaultExtensions(
    aliases = defaultAliases,
    environmentOverride,
    symmetricKey,
    environmentSourceNames,
  ) {
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

    const { default: encryptedDirective } = require('@app-config/encryption');
    const { default: v1Compat } = require('@app-config/v1-compat');
    const { default: gitRefDirectives } = require('@app-config/git');

    return [
      unescape$Directives(),
      tryDirective(),
      ifDirective(),
      eqDirective(),
      parseDirective(),
      hiddenDirective(),
      envDirective(aliases, environmentOverride, environmentSourceNames),
      envVarDirective(aliases, environmentOverride, environmentSourceNames),
      extendsDirective(),
      extendsSelfDirective(),
      overrideDirective(),
      timestampDirective(),
      substituteDirective(aliases, environmentOverride, environmentSourceNames),

      // these will be removed in v3
      v1Compat(true),
      gitRefDirectives(undefined, true),
      encryptedDirective(symmetricKey, true),
    ];
  },
  defaultEnvExtensions() {
    const { unescape$Directives, markAllValuesAsSecret } = require('@app-config/extensions');

    return [unescape$Directives(), markAllValuesAsSecret()];
  },
  defaultMetaExtensions() {
    const {
      unescape$Directives,
      tryDirective,
      ifDirective,
      eqDirective,
      hiddenDirective,
      extendsDirective,
      extendsSelfDirective,
      overrideDirective,
    } = require('@app-config/extensions');

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
