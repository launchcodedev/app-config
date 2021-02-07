import { withTempFiles } from '@app-config/test-utils';
import { LiteralSource } from '@app-config/core';
import { extendsDirective } from '@app-config/extensions';
import v1Compat from './index';

describe('v1Compat', () => {
  it('reads app-config property', async () => {
    await withTempFiles(
      {
        'some-file.json': JSON.stringify({ a: 'foo' }),
        'other-file.json': JSON.stringify({ b: 'bar' }),
      },
      async (inDir) => {
        const source = new LiteralSource({
          'app-config': {
            extends: inDir('./some-file.json'),
          },
          $extends: inDir('./other-file.json'),
        });

        const parsed = await source.read([v1Compat(), extendsDirective()]);

        expect(parsed.toJSON()).toEqual({ a: 'foo', b: 'bar' });
      },
    );
  });
});
