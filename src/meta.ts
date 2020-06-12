import { join } from 'path';
import { readJson } from 'fs-extra';
import * as _ from 'lodash';
import { findPackageRoot } from './util';
import { findParseableFile } from './file-loader';
import { GenerateFile } from './generate';

const metaFileNames = ['.app-config.meta', 'app-config.meta'];

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
  } catch (_) {
    /* allowed */
  }

  return _.merge({}, metaProps, packageConfig || {}, meta ? meta[2] : {}) as MetaProps;
};
