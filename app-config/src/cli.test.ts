import execa from 'execa';
import { join } from 'path';
import { withTempFiles } from './test-util';

const run = async (argv: string[], options?: execa.Options) =>
  execa('node', [join(__dirname, '..', './dist/cli.js'), ...argv], options);

describe('vars', () => {
  it('fails with no app-config', async () => {
    await expect(run(['vars'])).rejects.toThrow();
  });

  it('prints simple app-config file', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await run(['vars'], { env: { APP_CONFIG } });

    expect(stdout).toMatchSnapshot();
  });

  it('uses provided environment variable prefix', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await run(['vars', '--prefix', 'MY_CONFIG'], { env: { APP_CONFIG } });

    expect(stdout).toMatchSnapshot();
  });

  it('prints only nonSecrets without --secrets option', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `
          non-secret: true
        `,
        '.app-config.secrets.yml': `
          secret: true
        `,
      },
      async (inDir) => {
        const { stdout: withoutSecrets } = await run(['vars', '-C', inDir('.')]);
        expect(withoutSecrets).toMatchSnapshot();

        const { stdout: withSecrets } = await run(['vars', '--secrets', '-C', inDir('.')]);
        expect(withSecrets).toMatchSnapshot();
      },
    );
  });
});

describe('create', () => {
  it('fails with no app-config', async () => {
    await expect(run(['create'])).rejects.toThrow();
  });

  it('prints simple app-config file', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await run(['create'], { env: { APP_CONFIG } });

    expect(stdout).toMatchSnapshot();
  });

  it('prints YAML format', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await run(['create', '--format', 'yaml'], { env: { APP_CONFIG } });

    expect(stdout).toMatchSnapshot();
  });

  it('prints JSON format', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await run(['create', '--format', 'json'], { env: { APP_CONFIG } });

    expect(stdout).toMatchSnapshot();
  });

  it('prints JSON5 format', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await run(['create', '--format', 'json5'], { env: { APP_CONFIG } });

    expect(stdout).toMatchSnapshot();
  });

  it('prints TOML format', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await run(['create', '--format', 'toml'], { env: { APP_CONFIG } });

    expect(stdout).toMatchSnapshot();
  });

  it('can select a nested property', async () => {
    const APP_CONFIG = JSON.stringify({ a: { b: { c: true } } });
    const { stdout: nested1 } = await run(['create', '--format', 'json', '--select', '#/a'], {
      env: { APP_CONFIG },
    });

    expect(nested1).toMatchSnapshot();

    const { stdout: nested2 } = await run(['create', '--format', 'json', '--select', '#/a/b'], {
      env: { APP_CONFIG },
    });

    expect(nested2).toMatchSnapshot();

    const { stdout: nested3 } = await run(['create', '--format', 'json', '--select', '#/a/b/c'], {
      env: { APP_CONFIG },
    });

    expect(nested3).toMatchSnapshot();
  });

  it('fails with invalid property selector', async () => {
    const APP_CONFIG = JSON.stringify({ a: true });

    await expect(
      run(['create', '--format', 'json', '--select', '#/b'], {
        env: { APP_CONFIG },
      }),
    ).rejects.toThrow();
  });
});

describe('create-schema', () => {
  it('fails with no app-config schema', async () => {
    await expect(run(['create-schema'])).rejects.toThrow();
  });

  it('prints simple app-config schema', async () => {
    await withTempFiles(
      {
        '.app-config.schema.yml': `
          type: object
          properties:
            foo: { type: boolean }
        `,
      },
      async (inDir) => {
        const { stdout } = await run(['create-schema', '-C', inDir('.')]);

        expect(stdout).toMatchSnapshot();
      },
    );
  });

  it('prints YAML format', async () => {
    await withTempFiles(
      {
        '.app-config.schema.yml': `
          type: object
          properties:
            foo: { type: boolean }
        `,
      },
      async (inDir) => {
        const { stdout } = await run(['create-schema', '-C', inDir('.'), '--format', 'yaml']);

        expect(stdout).toMatchSnapshot();
      },
    );
  });

  it('prints JSON format', async () => {
    await withTempFiles(
      {
        '.app-config.schema.yml': `
          type: object
          properties:
            foo: { type: boolean }
        `,
      },
      async (inDir) => {
        const { stdout } = await run(['create-schema', '-C', inDir('.'), '--format', 'json']);

        expect(stdout).toMatchSnapshot();
      },
    );
  });

  it('prints JSON5 format', async () => {
    await withTempFiles(
      {
        '.app-config.schema.yml': `
          type: object
          properties:
            foo: { type: boolean }
        `,
      },
      async (inDir) => {
        const { stdout } = await run(['create-schema', '-C', inDir('.'), '--format', 'json5']);

        expect(stdout).toMatchSnapshot();
      },
    );
  });

  it('prints TOML format', async () => {
    await withTempFiles(
      {
        '.app-config.schema.yml': `
          type: object
          properties:
            foo: { type: boolean }
        `,
      },
      async (inDir) => {
        const { stdout } = await run(['create-schema', '-C', inDir('.'), '--format', 'toml']);

        expect(stdout).toMatchSnapshot();
      },
    );
  });

  it('can select a nested property', async () => {
    await withTempFiles(
      {
        '.app-config.schema.yml': `
          definitions:
            Foo:
              type: object
              properties:
                foo: { type: boolean }
            Bar:
              type: object
              properties:
                bar: { type: boolean }
        `,
      },
      async (inDir) => {
        const { stdout: nested1 } = await run([
          'create-schema',
          '-C',
          inDir('.'),
          '--select',
          '#/definitions/Foo',
        ]);
        expect(nested1).toMatchSnapshot();

        const { stdout: nested2 } = await run([
          'create-schema',
          '-C',
          inDir('.'),
          '--select',
          '#/definitions/Bar',
        ]);
        expect(nested2).toMatchSnapshot();
      },
    );
  });

  it('fails with invalid property selector', async () => {
    await withTempFiles(
      {
        '.app-config.schema.yml': `
          type: object
        `,
      },
      async (inDir) => {
        await expect(
          run(['create-schema', '-C', inDir('.'), '--select', '#/prop']),
        ).rejects.toThrow();
      },
    );
  });
});

describe('nested commands', () => {
  it('fails with no app-config', async () => {
    await expect(run(['--', 'env'])).rejects.toThrow();
  });

  it('passes environment variables down', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await run(['--', 'env'], { env: { APP_CONFIG } });

    expect(stdout.includes('APP_CONFIG_FOO=true')).toBe(true);
  });

  it('uses prefix in environment variables', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await run(['-p', 'MY_CONFIG', '--', 'env'], { env: { APP_CONFIG } });

    expect(stdout.includes('MY_CONFIG_FOO=true')).toBe(true);
  });

  it('uses file format in main environment variable', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await run(['--format', 'json', '--', 'env'], { env: { APP_CONFIG } });

    expect(stdout.includes('APP_CONFIG={"foo":true}')).toBe(true);
  });
});
