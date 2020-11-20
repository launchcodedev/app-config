export interface EnvironmentAliases {
  [alias: string]: string;
}

export const defaultAliases: EnvironmentAliases = {
  prod: 'production',
  dev: 'development',
};

export function currentEnvironment(aliases: EnvironmentAliases = defaultAliases) {
  const value = process.env.APP_CONFIG_ENV ?? process.env.NODE_ENV ?? process.env.ENV;

  if (!value) return undefined;

  if (aliases[value]) {
    return aliases[value];
  }

  return value;
}
