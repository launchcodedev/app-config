import { Json } from '@app-config/utils';
import { ParsingExtension, parseRawString, guessFileType, AppConfigError } from '@app-config/core';
import { forKey, validateOptions } from '@app-config/extension-utils';
import { resolveFilepath } from '@app-config/node';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface Options {
  command: string;
  failOnStderr: boolean;
  parseOutput: boolean;
  trimWhitespace: boolean;
}

class ExecError extends AppConfigError {
  name = 'ExecError';
}

function execParsingExtension(): ParsingExtension {
  return forKey(
    '$exec',
    validateOptions(
      (SchemaBuilder) =>
        SchemaBuilder.oneOf(
          SchemaBuilder.stringSchema(),
          SchemaBuilder.emptySchema()
            .addString('command')
            .addBoolean('failOnStderr', {}, false)
            .addBoolean('parseOutput', {}, false)
            .addBoolean('trimWhitespace', {}, false),
        ),
      (value) => async (parse, _, context) => {
        let options;

        if (typeof value === 'string') {
          options = { command: value };
        } else {
          options = value;
        }

        const {
          command,
          failOnStderr = false,
          parseOutput = false,
          trimWhitespace = true,
        } = options;

        try {
          const dir = resolveFilepath(context, '.');
          const { stdout, stderr } = await execAsync(command, { cwd: dir });

          if (failOnStderr && stderr) {
            throw new ExecError(`$exec command "${command}" produced stderr: ${stderr}`);
          }

          let result: Json = stdout;

          if (trimWhitespace) {
            result = stdout.trim();
          }

          if (parseOutput) {
            const fileType = await guessFileType(stdout);
            result = await parseRawString(stdout, fileType);
          }

          return parse(result, { shouldFlatten: true });
        } catch (err: unknown) {
          if (!isError(err)) {
            throw err;
          }

          if (err instanceof ExecError) {
            throw err;
          }

          throw new ExecError(`$exec command "${command}" failed with error:\n${err.message}`);
        }
      },
    ),
  );
}

/**
 * Check if a value is an Error.
 *
 * This was created because `value instanceof Error` was returning false
 * for normal-looking errors coming from `child_process` `exec()` command
 */
function isError(value: unknown): value is Error {
  return typeof value === 'object' && (value as Error).message !== undefined;
}

export default execParsingExtension;
