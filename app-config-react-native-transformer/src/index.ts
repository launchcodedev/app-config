import { loadValidatedConfig } from '@lcdev/app-config';
import { relative } from 'path';
import { Transformer, upstreamTransformer } from './upstream-transformer';

/**
 * Transform is called by Metro for each package resolved in the React Native project
 */
export const transform: Transformer['transform'] = async ({ src, filename, options }) => {
  // Get the relative path to app-config's entry point
  const appConfigPath = relative(
    options.projectRoot,
    require.resolve('@lcdev/app-config', {
      // Search relative to the project's root
      paths: [options.projectRoot],
    }),
  );

  // If the current module isn't app-config, pass-through to the default upstream transformer
  if (filename !== appConfigPath) {
    return upstreamTransformer.transform({ src, filename, options });
  }

  // Parse config and overwrite app-config's entry point with exported config JSON
  const { fullConfig } = await loadValidatedConfig();

  const modifiedSrc = `module.exports = ${JSON.stringify(fullConfig)};`;

  return upstreamTransformer.transform({ src: modifiedSrc, filename, options });
};
