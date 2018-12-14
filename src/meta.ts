import { join, basename, extname } from 'path';
import { outputFile, readJson } from 'fs-extra';
import * as _ from 'lodash';
import {
  quicktype,
  JSONSchemaInput,
  JSONSchemaSourceData,
  InputData,
} from 'quicktype-core';
import { findPackageRoot } from './util';
import { loadConfig } from './config';
import { loadSchema } from './schema';
import { findParseableFile } from './file-loader';

const metaFileNames = ['.app-config.meta', 'app-config.meta'];

type GenerateFile = {
  file: string,
  type?: string,
  name?: string,
  augmentModule?: boolean,
  leadingComments?: string[],
  rendererOptions?: { [key: string]: string },
};

type MetaProps = { generate: GenerateFile[] };

export const metaProps: any = {};

export const resetMetaProps = () => {
  for (const prop of Object.keys(metaProps)) {
    delete metaProps[prop];
  }
};

export const loadMeta = async (cwd = process.cwd()): Promise<MetaProps> => {
  const meta = await findParseableFile(metaFileNames.map(f => join(cwd, f)));

  let packageConfig;
  try {
    const packageRoot = await findPackageRoot(cwd);
    const { 'app-config': config } = await readJson(join(packageRoot, 'package.json'));

    packageConfig = config;
  } catch (_) {}

  return _.merge(
    {},
    metaProps,
    packageConfig || {},
    meta ? meta[1] : {},
  ) as MetaProps;
};

export const generateTypeFiles = async (cwd = process.cwd()) => {
  resetMetaProps();

  // trigger reload of config and schema files so that metaProps are up to date
  const [schema] = await Promise.all([
    loadSchema(cwd),
    loadConfig(cwd).catch((_) => {}),
  ]);

  const meta = await loadMeta(cwd);

  const { generate = [] } = meta;

  await Promise.all(generate.map(async ({
    file,
    type = extname(file).slice(1),
    name,
    augmentModule = true,
    leadingComments,
    rendererOptions = {},
  }) => {
    if (!name) {
      // default to PascalCase with non-word chars removed
      name = basename(file, extname(file)) /* tslint:disable-line */
        .split(/[^\w]/)
        .map(s => `${s.charAt(0).toUpperCase()}${s.slice(1)}`)
        .join('');
    }

    const src: JSONSchemaSourceData = {
      name,
      schema: JSON.stringify(schema),
    };

    const input = new JSONSchemaInput(undefined);
    await input.addSource(src);

    const inputData = new InputData();
    inputData.addInput(input);

    const { lines } = await quicktype({
      inputData,
      lang: type,
      indentation: '  ',
      leadingComments: leadingComments || [
        'AUTO GENERATED CODE',
        'Run app-config with \'generate\' command to regenerate this file',
      ],
      rendererOptions: {
        'just-types': 'true',
        'runtime-typecheck': 'false',
        ...rendererOptions,
      },
    });

    if (type === 'ts' && augmentModule !== false) {
      lines.push(...[
        '// augment the default export from app-config',
        "declare module '@servall/app-config' {",
        `  export interface ExportedConfig extends ${name} {}`,
        '}',
      ]);
    }

    await outputFile(join(cwd, file), lines.join('\n'));
  }));

  return generate;
};
