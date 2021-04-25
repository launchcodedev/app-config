import { LiteralSource } from '@app-config/core';
import { parseDirective } from './parse-directive';

describe('$parseBool', () => {
  it('should parse an existing boolean value', async () => {
    await expect(
      new LiteralSource({ $parseBool: true }).readToJSON([parseDirective()]),
    ).resolves.toBe(true);

    await expect(
      new LiteralSource({ $parseBool: false }).readToJSON([parseDirective()]),
    ).resolves.toBe(false);
  });

  it('should parse string values', async () => {
    await expect(
      new LiteralSource({ $parseBool: 'true' }).readToJSON([parseDirective()]),
    ).resolves.toBe(true);

    await expect(
      new LiteralSource({ $parseBool: 'false' }).readToJSON([parseDirective()]),
    ).resolves.toBe(false);

    await expect(
      new LiteralSource({ $parseBool: '1' }).readToJSON([parseDirective()]),
    ).resolves.toBe(true);

    await expect(
      new LiteralSource({ $parseBool: '0' }).readToJSON([parseDirective()]),
    ).resolves.toBe(false);

    await expect(
      new LiteralSource({ $parseBool: 'null' }).readToJSON([parseDirective()]),
    ).resolves.toBe(false);
  });

  it('should parse null as false', async () => {
    await expect(
      new LiteralSource({ $parseBool: null }).readToJSON([parseDirective()]),
    ).resolves.toBe(false);
  });

  it('should parse numbers', async () => {
    await expect(new LiteralSource({ $parseBool: 1 }).readToJSON([parseDirective()])).resolves.toBe(
      true,
    );

    await expect(new LiteralSource({ $parseBool: 0 }).readToJSON([parseDirective()])).resolves.toBe(
      false,
    );
  });
});

describe('$parseFloat', () => {
  it('should parse an existing number value', async () => {
    await expect(
      new LiteralSource({ $parseFloat: 12.12 }).readToJSON([parseDirective()]),
    ).resolves.toBe(12.12);

    await expect(
      new LiteralSource({ $parseFloat: 0 }).readToJSON([parseDirective()]),
    ).resolves.toBe(0);
  });

  it('should parse string values', async () => {
    await expect(
      new LiteralSource({ $parseFloat: '12.12' }).readToJSON([parseDirective()]),
    ).resolves.toBe(12.12);

    await expect(
      new LiteralSource({ $parseFloat: '0' }).readToJSON([parseDirective()]),
    ).resolves.toBe(0);
  });

  it('should reject invalid values', async () => {
    await expect(
      new LiteralSource({ $parseFloat: 'not a number' }).readToJSON([parseDirective()]),
    ).rejects.toThrow('Failed to $parseFloat');

    await expect(
      new LiteralSource({ $parseFloat: null }).readToJSON([parseDirective()]),
    ).rejects.toThrow('Failed to $parseFloat');

    await expect(
      new LiteralSource({ $parseFloat: [] }).readToJSON([parseDirective()]),
    ).rejects.toThrow('Failed to $parseFloat');
  });
});

describe('$parseInt', () => {
  it('should parse an existing number value', async () => {
    await expect(
      new LiteralSource({ $parseInt: 12.12 }).readToJSON([parseDirective()]),
    ).resolves.toBe(12);

    await expect(new LiteralSource({ $parseInt: 0 }).readToJSON([parseDirective()])).resolves.toBe(
      0,
    );
  });

  it('should parse string values', async () => {
    await expect(
      new LiteralSource({ $parseInt: '12.12' }).readToJSON([parseDirective()]),
    ).resolves.toBe(12);

    await expect(
      new LiteralSource({ $parseInt: '0' }).readToJSON([parseDirective()]),
    ).resolves.toBe(0);
  });

  it('should reject invalid values', async () => {
    await expect(
      new LiteralSource({ $parseInt: 'not a number' }).readToJSON([parseDirective()]),
    ).rejects.toThrow('Failed to $parseInt');

    await expect(
      new LiteralSource({ $parseInt: null }).readToJSON([parseDirective()]),
    ).rejects.toThrow('Failed to $parseInt');

    await expect(
      new LiteralSource({ $parseInt: [] }).readToJSON([parseDirective()]),
    ).rejects.toThrow('Failed to $parseInt');
  });
});
