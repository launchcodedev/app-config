import yargs from 'yargs';
import { defaultEnvExtensions, defaultExtensions, loadUnvalidatedConfig } from '@app-config/main';
import yargsParsingExtension from './index';

const makeOptions = (argv: string[]) => ({
  environmentExtensions: defaultEnvExtensions().concat(yargsParsingExtension({ argv })),
  parsingExtensions: defaultExtensions().concat(yargsParsingExtension({ argv })),
});

beforeEach(() => {
  yargs.reset();
});

describe('yargsParsingExtension', () => {
  it('loads an argument', async () => {
    process.env.APP_CONFIG = `
      foo:
        $yargs: foo
    `;

    const { fullConfig } = await loadUnvalidatedConfig(makeOptions(['--foo=bar']));

    expect(fullConfig).toEqual({ foo: 'bar' });
  });
});
