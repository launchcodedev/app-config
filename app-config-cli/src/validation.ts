import { readdir } from 'fs-extra';
import { logger } from '@app-config/logging';
import { FileSource, EnvironmentAliases, defaultAliases } from '@app-config/node';
import { loadValidatedConfig } from '@app-config/config';

export interface Options {
  /** Where app-config files are */
  directory?: string;
  /** Override for aliasing of environments */
  environmentAliases?: EnvironmentAliases;
  /** If app-config should be validating in a "no current environment" state */
  includeNoEnvironment?: boolean;
}

/**
 * Loads and validations app-config values in every environment detectable.
 *
 * Uses a hueristic to find which environments are available, because these are arbitrary.
 */
export async function validateAllConfigVariants({
  directory = '.',
  environmentAliases = defaultAliases,
  includeNoEnvironment = false,
}: Options = {}) {
  // first, we have to find any applicable app-config files
  // this is less trivial than config loading, because we can't "assume" the current environment (it could be anything)
  const filesInDirectory = await readdir(directory);
  const appConfigFiles = filesInDirectory.filter((filename) =>
    /^\.app-config\.(?:secrets\.)?(?:.*\.)?(?:yml|yaml|json|json5|toml)$/.exec(filename),
  );

  const appConfigEnvironments = new Set<string>();

  for (const filename of appConfigFiles) {
    // extract the environment out, which is the first capture group
    const regex = /^\.app-config\.(?:secrets\.)?(.*)\.(?:yml|yaml|json|json5|toml)$/;
    const environment = regex.exec(filename)?.[1];

    if (environment && environment !== 'meta' && environment !== 'schema') {
      appConfigEnvironments.add(environmentAliases[environment] ?? environment);
    }
  }

  await Promise.all(
    appConfigFiles.map(async (filename) => {
      const parsed = await new FileSource(filename).read(undefined, { environmentAliases });

      parsed.visitAll((value) => {
        const obj = value.asObject();

        if (obj?.$env) {
          for (const key of Object.keys(obj.$env.asObject() ?? {})) {
            appConfigEnvironments.add(environmentAliases[key] ?? key);
          }
        }
      });
    }),
  );

  // remove special-cased names
  appConfigEnvironments.delete('default');
  appConfigEnvironments.delete('secrets');
  appConfigEnvironments.delete('schema');
  appConfigEnvironments.delete('meta');

  logger.info(
    `Found ${appConfigEnvironments.size} environments to validate: [${Array.from(
      appConfigEnvironments,
    ).join(', ')}]`,
  );

  for (const environment of appConfigEnvironments) {
    logger.info(`Validating configuration for environment: ${environment}`);

    await loadValidatedConfig({
      directory,
      environmentOverride: environment,
      environmentVariableName: '', // do not load APP_CONFIG
    });
  }

  if (includeNoEnvironment || appConfigEnvironments.size === 0) {
    logger.info(`Validating configuration for no environment`);

    await loadValidatedConfig({
      directory,
      environmentVariableName: '', // do not load APP_CONFIG
    });
  }
}
