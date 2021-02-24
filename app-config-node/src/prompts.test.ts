import { mockedStdin } from '@app-config/test-utils';
import { promptUserWithRetry, consumeStdin } from './prompts';

describe('promptUserWithRetry', () => {
  it('accepts first valid response', async () => {
    await mockedStdin(async (send) => {
      send('bar').catch(() => {});

      await promptUserWithRetry({ type: 'text', message: 'Foo?' }, async (answer) => {
        expect(answer).toBe('bar');

        return true;
      });
    });
  });

  it('rejects after 3 tries', async () => {
    await mockedStdin(async (send) => {
      send('bar')
        .then(() => send('bar'))
        .then(() => send('bar'))
        .catch(() => {});

      await expect(
        promptUserWithRetry({ type: 'text', message: 'Foo?' }, async () => new Error('Nope')),
      ).rejects.toBeTruthy();
    });
  });
});

describe('consumeStdin', () => {
  it('consumes all lines until end', async () => {
    await mockedStdin(async (send, end) => {
      send('foo')
        .then(() => send('bar'))
        .then(() => send('baz'))
        .then(() => end())
        .catch(() => {});

      // we expect newlines to be eaten up, since this function is used for html and base64 data
      expect(await consumeStdin()).toBe('foobarbaz');
    });
  });
});
