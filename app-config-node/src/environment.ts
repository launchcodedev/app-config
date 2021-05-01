import { logger } from '@app-config/logging';

/** A mapping for "alias" names of environments, like "dev" => "development" */
export interface EnvironmentAliases {
  [alias: string]: string;
}

/** Options required for calling {@link currentEnvironment} */
export interface EnvironmentOptions {
  /** Absolute override for what the current environment is, still abiding by aliases */
  override?: string;
  /** A mapping for "alias" names of environments, like "dev" => "development" */
  aliases: EnvironmentAliases;
  /** What environment variable(s) define the current environment, if override is not defined */
  envVarNames: string[];
}

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
export function currentEnvironment(options?: EnvironmentOptions): string | undefined;

/** @deprecated use currentEnvironment(EnvironmentOptions) instead */
export function currentEnvironment(
  environmentAliases?: EnvironmentAliases,
  environmentSourceNames?: string[] | string,
): string | undefined;

export function currentEnvironment(...args: any[]): string | undefined {
  let environmentSourceNames: string[] = defaultEnvVarNames;
  let environmentAliases: EnvironmentAliases = defaultAliases;
  let environmentOverride: string | undefined;

  if (
    args[0] &&
    typeof args[0] === 'object' &&
    ('override' in args[0] || 'aliases' in args[0] || 'envVarNames' in args[0])
  ) {
    const options = args[0] as EnvironmentOptions;

    if (options.override) {
      environmentOverride = options.override;
    }

    if (options.aliases) {
      environmentAliases = options.aliases;
    }

    if (options.envVarNames) {
      environmentSourceNames = options.envVarNames;
    }
  } else {
    if (args[0]) {
      environmentAliases = args[0] as EnvironmentAliases;
      logger.warn('Detected deprecated usage of currentEnvironment');
    }

    if (Array.isArray(args[1])) {
      environmentSourceNames = args[1] as string[];
      logger.warn('Detected deprecated usage of currentEnvironment');
    } else if (typeof args[1] === 'string') {
      environmentSourceNames = [args[1]];
      logger.warn('Detected deprecated usage of currentEnvironment');
    }
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
