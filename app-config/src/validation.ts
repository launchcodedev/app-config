import { readdir } from 'fs-extra';
import { FileSource } from './config-source';
import { defaultAliases, EnvironmentAliases } from './environment';
import { loadValidatedConfig } from './config';
import { logger } from './logging';

export interface Options {
  directory?: string;
  environmentAliases?: EnvironmentAliases;
}

export async function validateAllConfigVariants({
  directory = '.',
  environmentAliases = defaultAliases,
}: Options = {}) {
  // first, we have to find any applicable app-config files
  // this is less trivial than config loading, because we can't "assume" the current environment (it could be anything)
  const filesInDirectory = await readdir(directory);
  const appConfigFiles = filesInDirectory.filter((filename) =>
    /^\.app-config\.(?:secrets\.)?(?:.*\.)?(?:yml|yaml|json|json5|toml)$/.exec(filename),
  );

  const appConfigEnvironments = new Set<string>();

  for (const filename of appConfigFiles) {
    const environment = /^\.app-config\.(?:secrets\.)?(.*)\.(?:yml|yaml|json|json5|toml)$/.exec(
      filename,
    )?.[1];

    if (environment && environment !== 'meta' && environment !== 'schema') {
      appConfigEnvironments.add(environmentAliases[environment] ?? environment);
    }
  }

  await Promise.all(
    appConfigFiles.map(async (filename) => {
      const parsed = await new FileSource(filename).read();

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
}
