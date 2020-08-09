import { join } from 'path';
import { dir } from 'tmp-promise';
import { outputFile, remove } from 'fs-extra';

export const withFakeFiles = async (
  files: [string, string][],
  cb: (dir: string) => Promise<void>,
) => {
  const { path: tmp } = await dir();
  const filenames = files.map(([name]) => join(tmp, name));

  await Promise.all(
    filenames.map(async (name, i) => {
      await outputFile(name, files[i][1]);
    }),
  );

  try {
    await cb(tmp);
  } finally {
    await remove(tmp);
  }
};
