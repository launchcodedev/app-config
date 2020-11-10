import readline from 'readline';
import { parse } from 'node-html-parser';
import {
  loadValidatedConfig,
  loadUnvalidatedConfig,
  ConfigLoadingOptions,
} from '@lcdev/app-config';

export interface Options {
  validate: boolean;
  configOptions?: ConfigLoadingOptions;
}

export async function injectHtml(
  html: string,
  { validate, configOptions }: Options,
): Promise<string> {
  const parsed = parse(html);

  const scriptTag = parsed.querySelector('script[id="app-config"]');

  if (!scriptTag) {
    throw new Error('No <script id="app-config"> was found in the given HTML!');
  }

  let config;

  if (validate) {
    config = await loadValidatedConfig(configOptions);
  } else {
    config = await loadUnvalidatedConfig(configOptions);
  }

  scriptTag.set_content(`window._appConfig=${JSON.stringify(config)}`);

  return parsed.toString();
}

export async function consumeStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin });

    let buffer = '';
    rl.on('line', (line) => {
      buffer += line;
    });

    rl.on('error', reject);
    rl.on('close', () => resolve(buffer));
  });
}
