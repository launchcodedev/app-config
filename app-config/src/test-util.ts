import { join } from 'path';
import { dir } from 'tmp-promise'; // eslint-disable-line import/no-extraneous-dependencies
import { outputFile, remove } from 'fs-extra';

// function that joins the temp dir to a filename
type JoinDir = (filename: string) => string;

export const withTempFiles = async (
  files: { [filename: string]: string },
  callback: (inDir: JoinDir) => Promise<void>,
) => {
  const { path: folder } = await dir();

  try {
    for (const [filename, contents] of Object.entries(files)) {
      await outputFile(join(folder, filename), contents);
    }

    await callback((filename) => join(folder, filename));
  } finally {
    await remove(folder);
  }
};
