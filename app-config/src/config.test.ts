import { loadConfig } from './config';
import { withTempFiles } from './test-util';

describe('Configuration Loading', () => {
  it('loads configuration', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `foo: 42`,
      },
      async (inDir) => {
        const { fullConfig } = await loadConfig({ directory: inDir('.') });

        expect(fullConfig).toEqual({ foo: 42 });
      },
    );
  });
});
