import { LiteralSource } from '@app-config/core';
import { withTempFiles } from '@app-config/test-utils';
import jsModuleDirective from './index';

describe('$jsModule directive', () => {
  it('loads function node export', () =>
    withTempFiles(
      {
        'foo.js': `
        module.exports = () => 'bar';
      `,
      },
      async (inDir) => {
        const source = new LiteralSource({
          $jsModule: inDir('foo.js'),
        });

        expect(await source.readToJSON([jsModuleDirective()])).toEqual('bar');
      },
    ));

  it('loads default function node export', () =>
    withTempFiles(
      {
        'foo.js': `
        module.exports.__esModule = true;
        module.exports.default = () => 'bar';
      `,
      },
      async (inDir) => {
        const source = new LiteralSource({
          $jsModule: inDir('foo.js'),
        });

        expect(await source.readToJSON([jsModuleDirective()])).toEqual('bar');
      },
    ));

  it('loads object node export', () =>
    withTempFiles(
      {
        'foo.js': `
        module.exports = 'bar';
      `,
      },
      async (inDir) => {
        const source = new LiteralSource({
          $jsModule: inDir('foo.js'),
        });

        expect(await source.readToJSON([jsModuleDirective()])).toEqual('bar');
      },
    ));

  it('loads default object node export', () =>
    withTempFiles(
      {
        'foo.js': `
        module.exports.__esModule = true;
        module.exports.default = 'bar';
      `,
      },
      async (inDir) => {
        const source = new LiteralSource({
          $jsModule: inDir('foo.js'),
        });

        expect(await source.readToJSON([jsModuleDirective()])).toEqual('bar');
      },
    ));
});
