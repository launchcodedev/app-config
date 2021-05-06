import { LiteralSource } from '@app-config/core';
import { timestampDirective } from './timestamp-directive';

describe('$timestamp directive', () => {
  it('uses the current date', async () => {
    const now = new Date();

    const source = new LiteralSource({
      now: { $timestamp: true },
    });

    const parsed = await source.read([timestampDirective(() => now)]);

    expect(parsed.toJSON()).toEqual({ now: now.toISOString() });
  });

  it('uses locale date string', async () => {
    const now = new Date(2020, 11, 25, 8, 30, 0);

    const source = new LiteralSource({
      now: {
        $timestamp: {
          locale: 'en-US',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        },
      },
    });

    const parsed = await source.read([timestampDirective(() => now)]);

    expect(parsed.toJSON()).toEqual({ now: 'Friday, December 25, 2020' });
  });

  it('rejects a bad option', async () => {
    const now = new Date();

    const source = new LiteralSource({
      now: { $timestamp: null },
    });

    await expect(source.read([timestampDirective(() => now)])).rejects.toThrow();
  });

  it('rejects a bad locale', async () => {
    const now = new Date();

    const source = new LiteralSource({
      now: { $timestamp: { locale: null } },
    });

    await expect(source.read([timestampDirective(() => now)])).rejects.toThrow();
  });
});
