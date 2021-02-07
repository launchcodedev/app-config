import { withTempFiles } from '@app-config/test-utils';
import { LiteralSource } from '@app-config/core';
import { generateSymmetricKey, encryptValue } from './encryption';
import encryptedDirective from './index';

describe('encryptedDirective', () => {
  it('loads an encrypted value', async () => {
    const symmetricKey = await generateSymmetricKey(1);

    const source = new LiteralSource({
      foo: await encryptValue('foobar', symmetricKey),
    });

    const parsed = await source.read([encryptedDirective(symmetricKey)]);

    expect(parsed.toJSON()).toEqual({ foo: 'foobar' });
  });

  it('loads an array of encrypted values', async () => {
    const symmetricKey = await generateSymmetricKey(1);

    const source = new LiteralSource({
      foo: [
        await encryptValue('value-1', symmetricKey),
        await encryptValue('value-2', symmetricKey),
        await encryptValue('value-3', symmetricKey),
      ],
    });

    const parsed = await source.read([encryptedDirective(symmetricKey)]);

    expect(parsed.toJSON()).toEqual({ foo: ['value-1', 'value-2', 'value-3'] });
  });
});
