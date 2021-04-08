import { forKey, validateOptions } from '@app-config/extension-utils';
import { ParsingExtension, AppConfigError } from '@app-config/core';
import { Json } from '@app-config/utils';
import yargs from 'yargs';

interface Options {
  argv?: string[];
}

function yargsParsingExtension({
  argv = process.argv,
}: Options = {}): ParsingExtension {
  const args = yargs.parse(argv);

  return forKey(
    '$yargs',
    validateOptions(
      (SchemaBuilder) => SchemaBuilder.stringSchema(),
      (value) => async (parse) => {
        if (value in args) {
          return parse(args[value] as Json, { shouldFlatten: true });
        }

        throw new AppConfigError(`Tried to use CLI arg named '${value}' but it was not found`);
      },
    ),
  );
}

export default yargsParsingExtension;
