import { isWindows } from '@app-config/utils';
import { withTempFiles } from '@app-config/test-utils';
import { cli } from './index';

interface Output {
  stdout: string;
  stdoutWrite: jest.Mock;
  processExit: jest.SpyInstance;
}

const runCLI = (argv: string[], { env }: { env?: Record<string, string> } = {}) =>
  new Promise<Output>((resolve, reject) => {
    let stdout = '';

    const stdoutWrite = jest.fn((line: string) => {
      stdout += line;
      return true;
    });

    process.chdir(__dirname);
    process.stdout.write = stdoutWrite;

    jest.spyOn(console, 'log').mockImplementation((line: string) => stdoutWrite(`${line}\n`));

    const processExit = jest.spyOn(process, 'exit');
    const originalEnv = { ...process.env };
    process.env = { ...originalEnv, ...env };

    const { running } = cli.fail((msg, err) => reject(err ?? msg)).parse(argv);

    (running as Promise<void>).then(() => {
      resolve({
        stdout,
        stdoutWrite,
        processExit,
      });

      process.env = { ...originalEnv };
    }, reject);
  });

describe('vars', () => {
  it('fails with no app-config', async () => {
    await expect(runCLI(['vars', '-q'])).rejects.toThrow();
  });

  it('prints simple app-config file', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await runCLI(['vars', '-q'], { env: { APP_CONFIG } });

    expect(stdout).toMatchSnapshot();
  });

  it('uses provided environment variable prefix', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await runCLI(['vars', '-q', '--prefix', 'MY_CONFIG'], {
      env: { APP_CONFIG },
    });

    expect(stdout).toMatchSnapshot();
  });

  it('renames a variable', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await runCLI(['vars', '-q', '--rename', 'APP_CONFIG_FOO=BAR'], {
      env: { APP_CONFIG },
    });

    expect(stdout).toMatchSnapshot();
  });

  it('aliases a variable', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await runCLI(['vars', '-q', '--alias', 'APP_CONFIG_FOO=BAR'], {
      env: { APP_CONFIG },
    });

    expect(stdout).toMatchSnapshot();
  });

  it('filters list of variables with --only', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true, bar: true });
    const { stdout } = await runCLI(['vars', '-q', '--prefix=""', '--only', 'FOO'], {
      env: { APP_CONFIG },
    });

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
        const { stdout: withoutSecrets } = await runCLI(['vars', '-q', '-C', inDir('.')]);
        expect(withoutSecrets).toMatchSnapshot();

        const { stdout: withSecrets } = await runCLI(['vars', '-q', '--secrets', '-C', inDir('.')]);
        expect(withSecrets).toMatchSnapshot();
      },
    );
  });
});

describe('create', () => {
  it('fails with no app-config', async () => {
    await expect(runCLI(['create'])).rejects.toThrow();
  });

  it('prints simple app-config file', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await runCLI(['create', '-q'], { env: { APP_CONFIG } });

    expect(stdout).toMatchSnapshot();
  });

  it('prints YAML format', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await runCLI(['create', '-q', '--format', 'yaml'], { env: { APP_CONFIG } });

    expect(stdout).toMatchSnapshot();
  });

  it('prints JSON format', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await runCLI(['create', '-q', '--format', 'json'], { env: { APP_CONFIG } });

    expect(stdout).toMatchSnapshot();
  });

  it('prints JSON5 format', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await runCLI(['create', '-q', '--format', 'json5'], { env: { APP_CONFIG } });

    expect(stdout).toMatchSnapshot();
  });

  it('prints TOML format', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await runCLI(['create', '-q', '--format', 'toml'], { env: { APP_CONFIG } });

    expect(stdout).toMatchSnapshot();
  });

  it('prints raw format', async () => {
    const APP_CONFIG = JSON.stringify({
      anObject: {},
      aBoolean: true,
      aNumber: 83.2,
      aString: 'foo',
    });

    const { stdout: out1 } = await runCLI(
      ['create', '-q', '--format', 'raw', '--select', '#/aBoolean'],
      { env: { APP_CONFIG } },
    );
    expect(out1).toMatchSnapshot();

    const { stdout: out2 } = await runCLI(
      ['create', '-q', '--format', 'raw', '--select', '#/aNumber'],
      { env: { APP_CONFIG } },
    );
    expect(out2).toMatchSnapshot();

    const { stdout: out3 } = await runCLI(
      ['create', '-q', '--format', 'raw', '--select', '#/aString'],
      { env: { APP_CONFIG } },
    );
    expect(out3).toMatchSnapshot();

    await expect(
      runCLI(['create', '-q', '--format', 'raw', '--select', '#/anObject'], {
        env: { APP_CONFIG },
      }),
    ).rejects.toThrow();
  });

  it('can select a nested property', async () => {
    const APP_CONFIG = JSON.stringify({ a: { b: { c: true } } });
    const { stdout: nested1 } = await runCLI(
      ['create', '-q', '--format', 'json', '--select', '#/a'],
      {
        env: { APP_CONFIG },
      },
    );

    expect(nested1).toMatchSnapshot();

    const { stdout: nested2 } = await runCLI(
      ['create', '-q', '--format', 'json', '--select', '#/a/b'],
      {
        env: { APP_CONFIG },
      },
    );

    expect(nested2).toMatchSnapshot();

    const { stdout: nested3 } = await runCLI(
      ['create', '-q', '--format', 'json', '--select', '#/a/b/c'],
      {
        env: { APP_CONFIG },
      },
    );

    expect(nested3).toMatchSnapshot();
  });

  it('fails with invalid property selector', async () => {
    const APP_CONFIG = JSON.stringify({ a: true });

    await expect(
      runCLI(['create', '-q', '--format', 'json', '--select', '#/b'], {
        env: { APP_CONFIG },
      }),
    ).rejects.toThrow();
  });

  it('uses fileNameBase option', async () => {
    await withTempFiles(
      {
        'my-app.yml': `
          foo: bar
        `,
        'my-app.schema.yml': `
          type: object
          properties:
            foo:
              type: string
        `,
      },
      async (inDir) => {
        const { stdout } = await runCLI(['create', '--fileNameBase=my-app', '-C', inDir('.')]);
        expect(stdout).toMatchSnapshot();

        const APP_CONFIG = JSON.stringify({ foo: true });
        await expect(
          runCLI(['create', '--fileNameBase=my-app', '-C', inDir('.')], { env: { APP_CONFIG } }),
        ).rejects.toThrow();
      },
    );
  });

  it.only('uses environmentOverride option', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `
          val:
            $env:
              default: 42
              prod: 88
        `,
      },
      async (inDir) => {
        const { stdout: defaultValue } = await runCLI(['vars', '-q', '-C', inDir('.')]);
        expect(defaultValue).toMatchSnapshot();

        const { stdout: production } = await runCLI([
          'vars',
          '-q',
          '-C',
          inDir('.'),
          '--environmentOverride=production',
        ]);

        expect(production).toMatchSnapshot();
      },
    );
  });

  it.only('uses environmentVariableName option', async () => {
    const MY_CONF = JSON.stringify({ foo: true });

    const { stdout } = await runCLI(['create', '-q', '--environmentVariableName=MY_CONF'], {
      env: { MY_CONF },
    });

    expect(stdout).toMatchSnapshot();

    await expect(
      runCLI(['create', '-q', '--environmentVariableName=MY_CONF'], {
        env: { APP_CONFIG: MY_CONF },
      }),
    ).rejects.toThrow();
  });
});

describe('create-schema', () => {
  it('fails with no app-config schema', async () => {
    await expect(runCLI(['create-schema'])).rejects.toThrow();
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
        const { stdout } = await runCLI(['create-schema', '-C', inDir('.')]);

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
        const { stdout } = await runCLI(['create-schema', '-C', inDir('.'), '--format', 'yaml']);

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
        const { stdout } = await runCLI(['create-schema', '-C', inDir('.'), '--format', 'json']);

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
        const { stdout } = await runCLI(['create-schema', '-C', inDir('.'), '--format', 'json5']);

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
        const { stdout } = await runCLI(['create-schema', '-C', inDir('.'), '--format', 'toml']);

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
        const { stdout: nested1 } = await runCLI([
          'create-schema',
          '-C',
          inDir('.'),
          '--select',
          '#/definitions/Foo',
        ]);
        expect(nested1).toMatchSnapshot();

        const { stdout: nested2 } = await runCLI([
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
          runCLI(['create-schema', '-C', inDir('.'), '--select', '#/prop']),
        ).rejects.toThrow();
      },
    );
  });
});

describe('nested commands', () => {
  it('fails with no app-config', async () => {
    await expect(runCLI(['-q', '--', isWindows ? 'SET' : 'env'])).rejects.toThrow();
  });

  it('passes environment variables down', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await runCLI(['-q', '--', isWindows ? 'SET' : 'env'], {
      env: { APP_CONFIG },
    });

    expect(stdout.includes('APP_CONFIG_FOO=true')).toBe(true);
  });

  it('uses prefix in environment variables', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await runCLI(['-q', '-p', 'MY_CONFIG', '--', isWindows ? 'SET' : 'env'], {
      env: { APP_CONFIG },
    });

    expect(stdout.includes('MY_CONFIG_FOO=true')).toBe(true);
  });

  it('uses file format in main environment variable', async () => {
    const APP_CONFIG = JSON.stringify({ foo: true });
    const { stdout } = await runCLI(['-q', '--format', 'json', '--', isWindows ? 'SET' : 'env'], {
      env: { APP_CONFIG },
    });

    expect(stdout.includes('APP_CONFIG={"foo":true}')).toBe(true);
  });

  it('passes APP_CONFIG_SCHEMA variable in', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `
          foo: true
        `,
        '.app-config.schema.yml': `
          $schema: http://json-schema.org/draft-07/schema
          type: object
          properties:
            foo: { type: boolean }
        `,
      },
      async (inDir) => {
        const { stdout } = await runCLI([
          '--format',
          'json',
          '-C',
          inDir('.'),
          '--',
          isWindows ? 'SET' : 'env',
        ]);

        expect(stdout.includes('APP_CONFIG={"foo":true}')).toBe(true);
        expect(
          stdout.includes(
            'APP_CONFIG_SCHEMA={"$schema":"http://json-schema.org/draft-07/schema","type":"object","properties":{"foo":{"type":"boolean"}}}',
          ),
        ).toBe(true);
      },
    );
  });
});
