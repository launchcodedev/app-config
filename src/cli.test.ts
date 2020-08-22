import execa from 'execa';
import { join } from 'path';
import { withFakeFiles } from './test-util';

const runCli = async (argv: string[]) => {
  return execa('node', [join(__dirname, '..', './dist/cli.js'), ...argv]);
};

describe('vars', () => {
  test('no app config', async () => {
    await expect(runCli(['vars'])).rejects.toBeTruthy();
  });

  test('basic', async () => {
    await withFakeFiles(
      [
        [
          '.app-config.yml',
          `
            foo: bar
          `,
        ],
        ['.app-config.schema.yml', `type: object`],
      ],
      async dir => {
        const { stdout } = await runCli(['-C', dir, 'vars']);

        expect(stdout).toEqual('APP_CONFIG_FOO="bar"');
      },
    );
  });

  test('with prefix', async () => {
    await withFakeFiles(
      [
        [
          '.app-config.yml',
          `
            foo: bar
          `,
        ],
        ['.app-config.schema.yml', `type: object`],
      ],
      async dir => {
        const { stdout } = await runCli(['-C', dir, 'vars', '--prefix', 'CONFIG']);

        expect(stdout).toEqual('CONFIG_FOO="bar"');
      },
    );
  });

  test('with secrets', async () => {
    await withFakeFiles(
      [
        [
          '.app-config.yml',
          `
            foo: bar
          `,
        ],
        [
          '.app-config.secrets.yml',
          `
            bar: baz
          `,
        ],
        ['.app-config.schema.yml', `type: object`],
      ],
      async dir => {
        {
          const { stdout } = await runCli(['-C', dir, 'vars']);
          expect(stdout).toEqual('APP_CONFIG_FOO="bar"');
        }

        {
          const { stdout } = await runCli(['-C', dir, 'vars', '-s']);
          expect(stdout).toEqual('APP_CONFIG_FOO="bar"\nAPP_CONFIG_BAR="baz"');
        }
      },
    );
  });
});

describe('create', () => {
  test('no app config', async () => {
    await expect(runCli(['create'])).rejects.toBeTruthy();
  });

  test('basic', async () => {
    await withFakeFiles(
      [
        [
          '.app-config.yml',
          `
            foo: bar
          `,
        ],
        ['.app-config.schema.yml', `type: object`],
      ],
      async dir => {
        {
          const { stdout } = await runCli(['create', '-C', dir]);
          expect(stdout).toMatchSnapshot();
        }

        {
          const { stdout } = await runCli(['create', '-C', dir, '--format', 'json']);
          expect(stdout).toMatchSnapshot();
        }

        {
          const { stdout } = await runCli(['create', '-C', dir, '--format', 'json5']);
          expect(stdout).toMatchSnapshot();
        }

        {
          const { stdout } = await runCli(['create', '-C', dir, '--format', 'toml']);
          expect(stdout).toMatchSnapshot();
        }
      },
    );
  });

  test('selects', async () => {
    await withFakeFiles(
      [
        [
          '.app-config.yml',
          `
            foo:
              bar:
                baz: 42
          `,
        ],
        [
          '.app-config.secrets.yml',
          `
            foo:
              bar:
                secretValue: 99
          `,
        ],
        ['.app-config.schema.yml', `type: object`],
      ],
      async dir => {
        {
          const { stdout } = await runCli(['create', '-C', dir, '--select', '#/foo']);
          expect(stdout).toMatchSnapshot();
        }

        {
          const { stdout } = await runCli(['create', '-C', dir, '--select', '#/foo/bar']);
          expect(stdout).toMatchSnapshot();
        }

        {
          const { stdout } = await runCli(['create', '-C', dir, '--select', '#/foo/bar', '-s']);
          expect(stdout).toMatchSnapshot();
        }
      },
    );
  });
});

describe('create-schema', () => {
  test('resolve references', async () => {
    await withFakeFiles(
      [
        [
          '.app-config.schema.yml',
          `
            type: object
            properties:
              foo: { $ref: '.other-schema.yml#/definitions/Foo' }
          `,
        ],
        [
          '.other-schema.yml',
          `
            definitions:
              Foo:
                type: string
                format: uri
          `,
        ],
      ],
      async dir => {
        {
          const { stdout } = await runCli(['-C', dir, 'create-schema']);

          expect(stdout).toMatchSnapshot();
        }

        {
          const { stdout } = await runCli([
            '-C',
            dir,
            'create-schema',
            '--select',
            '#/properties/foo',
          ]);

          expect(stdout).toMatchSnapshot();
        }

        {
          const { stdout } = await runCli([
            '-C',
            dir,
            'create-schema',
            '--select',
            '#/properties/foo',
            '--format',
            'json',
          ]);

          expect(stdout).toMatchSnapshot();
        }
      },
    );
  });
});

describe('generate', () => {
  // TODO
});

describe('secret', () => {
  // TODO
});

describe('run', () => {
  test('env', async () => {
    await withFakeFiles(
      [
        [
          '.app-config.yml',
          `
            foo: bar
          `,
        ],
        ['.app-config.schema.yml', `type: object`],
      ],
      async dir => {
        {
          const { stdout } = await runCli(['-C', dir, '--', 'env']);
          const variables = stdout.split('\n');
          expect(variables.includes('APP_CONFIG_FOO=bar')).toBe(true);
          expect(variables.includes('APP_CONFIG=foo: bar')).toBe(true);
        }

        {
          const { stdout } = await runCli(['-C', dir, '--format', 'json', '--', 'env']);
          const variables = stdout.split('\n');
          expect(variables.includes('APP_CONFIG_FOO=bar')).toBe(true);
          expect(variables.includes('APP_CONFIG={"foo":"bar"}')).toBe(true);
        }

        {
          const { stdout } = await runCli([
            '-C',
            dir,
            '--prefix',
            'PREFIX',
            '--format',
            'json',
            '--',
            'env',
          ]);
          const variables = stdout.split('\n');
          expect(variables.includes('PREFIX_FOO=bar')).toBe(true);
          expect(variables.includes('PREFIX={"foo":"bar"}')).toBe(true);
        }
      },
    );
  });
});
