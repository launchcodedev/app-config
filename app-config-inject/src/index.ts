import { parse } from 'node-html-parser';
import {
  loadValidatedConfig,
  loadUnvalidatedConfig,
  ConfigLoadingOptions,
} from '@app-config/config';
import { SchemaLoadingOptions } from '@app-config/schema';

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

  let config;

  if (validate) {
    ({ fullConfig: config } = await loadValidatedConfig(configOptions, schemaOptions));
  } else {
    ({ fullConfig: config } = await loadUnvalidatedConfig(configOptions));
  }

  scriptTag.set_content(`window._appConfig=${JSON.stringify(config)}`);

  return parsed.toString();
}
