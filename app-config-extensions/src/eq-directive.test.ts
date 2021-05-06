import { LiteralSource } from '@app-config/core';
import { eqDirective } from './eq-directive';
import { envDirective } from './index';

describe('$eq directive', () => {
  it('returns true for empty', async () => {
    const source = new LiteralSource({
      $eq: [],
    });

    expect(await source.readToJSON([eqDirective()])).toBe(true);
  });

  it('returns true for two numbers', async () => {
    const source = new LiteralSource({
      $eq: [42, 42],
    });

    expect(await source.readToJSON([eqDirective()])).toBe(true);
  });

  it('returns false for two numbers', async () => {
    const source = new LiteralSource({
      $eq: [42, 44],
    });

    expect(await source.readToJSON([eqDirective()])).toBe(false);
  });

  it('returns true for two objects', async () => {
    const source = new LiteralSource({
      $eq: [{ a: true }, { a: true }],
    });

    expect(await source.readToJSON([eqDirective()])).toBe(true);
  });

  it('returns false for two objects', async () => {
    const source = new LiteralSource({
      $eq: [{ a: true }, { b: true }],
    });

    expect(await source.readToJSON([eqDirective()])).toBe(false);
  });

  it('parses before checking equality', async () => {
    process.env.APP_CONFIG_ENV = 'test';
    const source = new LiteralSource({
      $eq: [{ $env: { default: { a: true } } }, { $env: { test: { a: true } } }],
    });

    expect(await source.readToJSON([eqDirective(), envDirective()])).toBe(true);
  });
});
