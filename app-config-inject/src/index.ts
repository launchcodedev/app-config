import { parse } from 'node-html-parser';
import {
  loadValidatedConfig,
  loadUnvalidatedConfig,
  ConfigLoadingOptions,
} from '@app-config/config';
import { SchemaLoadingOptions } from '@app-config/schema';
import type { Json } from '@app-config/utils';

export { cli } from './cli';

export interface Options {
  validate: boolean;
  configOptions?: ConfigLoadingOptions;
  schemaOptions?: SchemaLoadingOptions;
}

export async function injectHtml(
  html: string,
  { validate, configOptions, schemaOptions }: Options,
): Promise<string> {
  const parsed = parse(html);

  const scriptTag = parsed.querySelector('script[id="app-config"]');

  if (!scriptTag) {
    throw new Error('No <script id="app-config"> was found in the given HTML!');
  }

  let config: Json;
  let environment: string | undefined;

  if (validate) {
    ({ fullConfig: config, environment } = await loadValidatedConfig(configOptions, schemaOptions));
  } else {
    ({ fullConfig: config, environment } = await loadUnvalidatedConfig(configOptions));
  }

  const configString = JSON.stringify(config);
  const environmentString = environment ? JSON.stringify(environment) : 'undefined';

  scriptTag.set_content(
    `window._appConfig=${configString}, window._appConfigEnvironment=${environmentString}`,
  );

  return parsed.toString();
}
