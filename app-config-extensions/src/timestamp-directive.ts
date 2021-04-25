import type { ParsingExtension } from '@app-config/core';
import { AppConfigError } from '@app-config/core';
import { named, forKey, validateOptions } from '@app-config/extension-utils';

/** Provides the current timestamp using { $timestamp: true } */
export function timestampDirective(dateSource: () => Date = () => new Date()): ParsingExtension {
  return named(
    '$timestamp',
    forKey(
      '$timestamp',
      validateOptions(
        (SchemaBuilder) =>
          SchemaBuilder.oneOf(
            SchemaBuilder.booleanSchema(),
            SchemaBuilder.emptySchema()
              .addString('day', {}, false)
              .addString('month', {}, false)
              .addString('year', {}, false)
              .addString('weekday', {}, false)
              .addString('locale', {}, false)
              .addString('timeZone', {}, false)
              .addString('timeZoneName', {}, false),
          ),
        (value) => (parse) => {
          let formatted: string;
          const date = dateSource();

          if (value === true) {
            formatted = date.toISOString();
          } else if (typeof value === 'object') {
            const { locale, ...options } = value;

            formatted = date.toLocaleDateString(locale, options as Intl.DateTimeFormatOptions);
          } else {
            throw new AppConfigError('$timestamp was provided an invalid option');
          }

          return parse(formatted, { shouldFlatten: true });
        },
      ),
    ),
  );
}
