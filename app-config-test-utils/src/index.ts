import { join } from 'path';
import { dir } from 'tmp-promise';
import { outputFile, remove } from 'fs-extra';
import { stdin } from 'mock-stdin';

// eslint-disable-next-line global-require
const { isTestEnvAndShouldNotPrompt } = require('@app-config/core') as {
  isTestEnvAndShouldNotPrompt(v: boolean): void;
};

// function that joins the temp dir to a filename
type JoinDir = (filename: string) => string;

export async function withTempFiles(
  files: { [filename: string]: string },
  callback: (inDir: JoinDir, dir: string) => Promise<void>,
): Promise<void>;

export async function withTempFiles(
  files: [string, string][],
  callback: (inDir: JoinDir, dir: string) => Promise<void>,
): Promise<void>;

export async function withTempFiles(
  files: { [filename: string]: string } | [string, string][],
  callback: (inDir: JoinDir, dir: string) => Promise<void>,
) {
  const { path: folder } = await dir();

  try {
    const entries = Array.isArray(files) ? files : Object.entries(files);

    for (const [filename, contents] of entries) {
      await outputFile(join(folder, filename), contents);
    }

    await callback((filename) => join(folder, filename), folder);
  } finally {
    await remove(folder);
  }
}

export async function mockedStdin(
  callback: (send: (text: string) => Promise<void>, end: () => void) => Promise<void>,
) {
  const mock = stdin();
  isTestEnvAndShouldNotPrompt(false);
  process.stdin.isTTY = true;
  process.stdout.isTTY = true;

  // to keep test output clean, just mock out stdout.write
  const origWrite = process.stdout.write;
  const mockWrite = jest.fn();
  process.stdout.write = mockWrite;

  try {
    const send = (text: string) =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          mock.send(text);
          mock.send('\n');
          resolve();
        }, 0);
      });

    await callback(send, () => mock.end());
  } finally {
    isTestEnvAndShouldNotPrompt(true);
    process.stdin.isTTY = false;
    process.stdout.isTTY = false;
    process.stdout.write = origWrite;
    mock.restore();
  }
}
