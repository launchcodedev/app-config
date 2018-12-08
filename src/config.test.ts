import { FileType } from './file-loader';
import { loadConfig, ConfigSource } from './config';

test('load env config', async () => {
  process.env.APP_CONFIG = `
    [foo]
    bar = true
  `;

  const { config, secrets, fileType, source } = await loadConfig();

  expect(config).toEqual({
    foo: {
      bar: true,
    },
  });

  expect(secrets).toBe(undefined);
  expect(fileType).toBe(FileType.TOML);
  expect(source).toBe(ConfigSource.EnvVar);

  delete process.env.APP_CONFIG;
});
