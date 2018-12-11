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

type MetaProps = {
  generate: { type: string, file: string, name?: string }[];
};

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
  type GenerateTypes = { type: string, file: string };

  resetMetaProps();

  // trigger reload of config and schema files so that metaProps are up to date
  const [schema] = await Promise.all([
    loadSchema(cwd),
    loadConfig(cwd).catch((_) => {}),
  ]);

  const meta = await loadMeta(cwd);

  const { generate = [] } = meta;

  await Promise.all(generate.map(async ({ type, file, name = basename(file, extname(file)) }) => {
    const src = {
      name,
      schema: JSON.stringify(schema),
    } as JSONSchemaSourceData;

    const input = new JSONSchemaInput(undefined);
    await input.addSource(src);

    const inputData = new InputData();
    inputData.addInput(input);

    const { lines } = await quicktype({
      inputData,
      lang: type,
      indentation: '  ',
      leadingComments: [
        'AUTO GENERATED CODE',
        'Run app-config with --generate to regenerate this file',
      ],
      rendererOptions: {
        'just-types': 'true',
        'runtime-typecheck': 'false',
      },
    });

    await outputFile(join(cwd, file), lines.join('\n'));
  }));

  return generate;
};
