import { named } from '@app-config/extension-utils';
import { ParsingExtension } from '@app-config/core';

import { tryDirective } from './try-directive';
import { ifDirective } from './if-directive';
import { eqDirective } from './eq-directive';
import { hiddenDirective } from './hidden-directive';
import { envDirective } from './env-directive';
import { extendsDirective, extendsSelfDirective, overrideDirective } from './extends-directive';
import { timestampDirective } from './timestamp-directive';
import { envVarDirective } from './env-var-directive';
import { substituteDirective } from './substitute-directive';
import { parseDirective } from './parse-directive';

export {
  tryDirective,
  ifDirective,
  eqDirective,
  hiddenDirective,
  envDirective,
  extendsDirective,
  extendsSelfDirective,
  overrideDirective,
  timestampDirective,
  envVarDirective,
  substituteDirective,
  parseDirective,
};

/** Marks all values recursively as fromSecrets, so they do not trigger schema errors */
export function markAllValuesAsSecret(): ParsingExtension {
  return named('markAllValuesAsSecret', (value) => (parse) => parse(value, { fromSecrets: true }));
}

/** When a key $$foo is seen, change it to be $foo and mark with meta property fromEscapedDirective */
export function unescape$Directives(): ParsingExtension {
  return named('unescape$', (value, [_, key]) => {
    if (typeof key === 'string' && key.startsWith('$$')) {
      return async (parse) => {
        return parse(value, { rewriteKey: key.slice(1), fromEscapedDirective: true });
      };
    }

    return false;
  });
}

export function defaultExtensions() {
  return [
    unescape$Directives(),
    tryDirective(),
    ifDirective(),
    eqDirective(),
    parseDirective(),
    hiddenDirective(),
    envDirective(),
    envVarDirective(),
    extendsDirective(),
    extendsSelfDirective(),
    overrideDirective(),
    timestampDirective(),
    substituteDirective(),
  ];
}

export function defaultEnvExtensions() {
  return [unescape$Directives(), markAllValuesAsSecret()];
}

export function defaultMetaExtensions() {
  return [
    unescape$Directives(),
    tryDirective(),
    ifDirective(),
    eqDirective(),
    hiddenDirective(),
    extendsDirective(),
    extendsSelfDirective(),
    overrideDirective(),
  ];
}
