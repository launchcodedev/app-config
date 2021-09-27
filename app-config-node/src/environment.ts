import { ParsingContext } from '@app-config/core';

/** A mapping for "alias" names of environments, like "dev" => "development" */
export interface EnvironmentAliases {
  [alias: string]: string;
}

/** Options required for calling {@link currentEnvironment} */
export type EnvironmentOptions = {
  /** Absolute override for what the current environment is, still abiding by aliases */
  override?: string;
  /** A mapping for "alias" names of environments, like "dev" => "development" */
  aliases: EnvironmentAliases;
  /** What environment variable(s) define the current environment, if override is not defined */
  envVarNames: string[];
};

/** Default aliases that app-config will resolve for you */
export const defaultAliases: EnvironmentAliases = {
  prod: 'production',
  dev: 'development',
};

/** Default environment variables that app-config will read */
export const defaultEnvVarNames = ['APP_CONFIG_ENV', 'NODE_ENV', 'ENV'];

/** Default options for {@link currentEnvironment} */
export const defaultEnvOptions: EnvironmentOptions = {
  aliases: defaultAliases,
  envVarNames: defaultEnvVarNames,
};

/** Conversion function useful for old usage of the deprecated {@link currentEnvironment} form */
export function asEnvOptions(
  override?: string,
  aliases: EnvironmentAliases = defaultAliases,
  environmentSourceNames: string[] | string = defaultEnvVarNames,
): EnvironmentOptions {
  return {
    override,
    aliases,
    envVarNames:
      typeof environmentSourceNames === 'string'
        ? [environmentSourceNames]
        : environmentSourceNames,
  };
}

/** Retrieve what app-config thinks the current deployment environment is (ie QA, dev, staging, production) */
export function currentEnvironment(options?: EnvironmentOptions): string | undefined {
  let environmentSourceNames: string[] = defaultEnvVarNames;
  let environmentAliases: EnvironmentAliases = defaultAliases;
  let environmentOverride: string | undefined;

  if (options?.override) {
    environmentOverride = options.override;
  }

  if (options?.aliases) {
    environmentAliases = options.aliases;
  }

  if (options?.envVarNames) {
    environmentSourceNames = options.envVarNames;
  }

  if (environmentOverride) {
    if (environmentAliases[environmentOverride]) {
      return environmentAliases[environmentOverride];
    }

    return environmentOverride;
  }

  let value: string | undefined;

  for (const name of environmentSourceNames) {
    if (process.env[name]?.length) {
      value = process.env[name];
      break;
    }
  }

  if (!value) return undefined;

  if (environmentAliases[value]) {
    return environmentAliases[value];
  }

  return value;
}

/** Reverse lookup of any aliases for some environment */
export function aliasesFor(env: string, aliases: EnvironmentAliases): string[] {
  return Object.entries(aliases)
    .filter(([, value]) => value === env)
    .map(([key]) => key);
}

export function environmentOptionsFromContext(
  context: ParsingContext,
): EnvironmentOptions | undefined {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  return context.environmentOptions as unknown as EnvironmentOptions;
}

export function currentEnvFromContext(
  context: ParsingContext,
  options?: EnvironmentOptions,
): string | undefined {
  const environmentOptions = environmentOptionsFromContext(context);

  if (environmentOptions) {
    return currentEnvironment(environmentOptions);
  }

  return currentEnvironment(options);
}
