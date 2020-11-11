/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { loadValidatedConfig } from '@lcdev/app-config';
import { Transformer, upstreamTransformer } from './upstream-transformer';

export const transform: Transformer['transform'] = ({ src, filename, options }) => {
  if (filename !== 'node_modules/@lcdev/app-config/dist/index.js') {
    return upstreamTransformer.transform({ src, filename, options });
  }

  return loadValidatedConfig().then(({ parsedNonSecrets }) => {
    const modifiedSrc = `
      module.exports = ${JSON.stringify(parsedNonSecrets)};
    `;
    return upstreamTransformer.transform({ src: modifiedSrc, filename, options });
  });
};
