import { Json, parseRawString, ParsingExtension } from '@lcdev/app-config';
import { guessFileType } from '@lcdev/app-config/dist/config-source';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface Options {
  command: string;
  failOnStderr: boolean;
  parseOutput: boolean;
  trimWhitespace: boolean;
}

class ExecError extends Error {
  name = 'ExecError';
}

function parseOptions(parsed: Json): Options {
  if (typeof parsed === 'string') {
    return { command: parsed, failOnStderr: false, parseOutput: false, trimWhitespace: true };
  }

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const { command, failOnStderr = false, parseOutput = false, trimWhitespace = true } = parsed;

    if (typeof command !== 'string') {
      throw new ExecError('$exec requires a "command" option');
    }

    if (typeof failOnStderr !== 'boolean') {
      throw new ExecError('$exec "failOnStderr" option must be a boolean');
    }

    if (typeof parseOutput !== 'boolean') {
      throw new ExecError('$exec "parseString" option must be a boolean');
    }

    if (typeof trimWhitespace !== 'boolean') {
      throw new ExecError('$exec "trimWhitespace" option must be a boolean');
    }

    return { command, failOnStderr, parseOutput, trimWhitespace };
  }

  throw new ExecError('$exec must be a string, or object with options');
}

function execParsingExtension(): ParsingExtension {
  return (value, [_, objectKey]) => {
    if (objectKey !== '$exec') {
      return false;
    }

    return async (parse) => {
      const parsed = await parse(value).then((v) => v.toJSON());

      const { command, failOnStderr, parseOutput, trimWhitespace } = parseOptions(parsed);

      try {
        const { stdout, stderr } = await execAsync(command);

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
    };
  };
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
