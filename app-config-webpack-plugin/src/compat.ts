/* eslint-disable */

import { join } from 'path';
import type { loadValidatedConfig } from '@lcdev/app-config';

// a simple compatibility layer between V1 and V2 - not type safe for obvious reasons

const { version } = require(join(require.resolve('@lcdev/app-config'), '../../package.json'));

let loadConfig: typeof loadValidatedConfig;

if (version.startsWith('1.')) {
  const { loadValidated: loadConfigV1 } = require('@lcdev/app-config/dist/exports');

  console.warn('Using app-config v1 compat layer!');

  loadConfig = async () => {
    const { nonSecrets, fileSource } = await loadConfigV1();

    return { fullConfig: nonSecrets, filePaths: [fileSource], parsed: null as any };
  };
} else {
  ({ loadValidatedConfig: loadConfig } = require('@lcdev/app-config'));
}

export { loadConfig };
