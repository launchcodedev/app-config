export interface EnvironmentAliases {
  [alias: string]: string;
}

export const defaultAliases: EnvironmentAliases = {
  prod: 'production',
  dev: 'development',
};

export function currentEnvironment(
  environmentAliases: EnvironmentAliases = defaultAliases,
  environmentSourceNames: string[] | string = ['APP_CONFIG_ENV', 'NODE_ENV', 'ENV'],
) {
  let value: string | undefined;

  for (const name of Array.isArray(environmentSourceNames)
    ? environmentSourceNames
    : [environmentSourceNames]) {
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
