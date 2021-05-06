import type { ParsingExtension } from '@app-config/core';
import { AppConfigError } from '@app-config/core';
import { named, forKey, keysToPath, validateOptions } from '@app-config/extension-utils';
import {
  currentEnvFromContext,
  defaultAliases,
  asEnvOptions,
  EnvironmentAliases,
} from '@app-config/node';

/** Looks up an environment-specific value ($env) */
export function envDirective(
  aliases: EnvironmentAliases = defaultAliases,
  environmentOverride?: string,
  environmentSourceNames?: string[] | string,
): ParsingExtension {
  const metadata = { shouldOverride: true };

  return named(
    '$env',
    forKey(
      '$env',
      validateOptions(
        (SchemaBuilder) => SchemaBuilder.emptySchema().addAdditionalProperties(),
        (value, _, parentKeys, context) => (parse) => {
          const environment = currentEnvFromContext(
            context,
            asEnvOptions(environmentOverride, aliases, environmentSourceNames),
          );

          if (!environment) {
            if ('none' in value) {
              return parse(value.none, metadata);
            }

            if ('default' in value) {
              return parse(value.default, metadata);
            }

            const path = keysToPath(parentKeys);

            throw new AppConfigError(
              `An $env directive was used (in ${path}), but current environment (eg. NODE_ENV) is undefined`,
            );
          }

          for (const [envName, envValue] of Object.entries(value)) {
            if (envName === environment || aliases[envName] === environment) {
              return parse(envValue, metadata);
            }
          }

          if ('default' in value) {
            return parse(value.default, metadata);
          }

          const found = Object.keys(value).join(', ');
          const path = keysToPath(parentKeys);

          throw new AppConfigError(
            `An $env directive was used (in ${path}), but none matched the current environment (wanted ${environment}, saw [${found}])`,
          );
        },
        // $env is lazy so that non-applicable envs don't get evaluated
        { lazy: true },
      ),
    ),
  );
}
