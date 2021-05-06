import simpleGit from 'simple-git';
import { ParsingExtension, AppConfigError, Fallbackable } from '@app-config/core';
import { named, forKey, validateOptions } from '@app-config/extension-utils';

class GitError extends Fallbackable {}

/** Access to the git branch and commit ref */
export default function gitRefDirectives(
  getStatus: typeof gitStatus = gitStatus,
): ParsingExtension {
  return named(
    '$git',
    forKey(
      '$git',
      validateOptions(
        (SchemaBuilder) => SchemaBuilder.stringSchema(),
        (value) => async (parse) => {
          switch (value) {
            case 'commit':
              return getStatus().then(({ commitRef }) => parse(commitRef, { shouldFlatten: true }));

            case 'commitShort':
              return getStatus().then(({ commitRef }) =>
                parse(commitRef.slice(0, 7), { shouldFlatten: true }),
              );

            case 'branch':
            case 'branchName':
              return getStatus().then(({ branchName }) => {
                if (!branchName) {
                  throw new AppConfigError(
                    'The $git directive tried to retrieve branchname, but it appears no branch is checked out',
                  );
                }

                return parse(branchName, { shouldFlatten: true });
              });

            case 'tag':
              return getStatus().then(({ tag }) => {
                return parse(tag ?? null, { shouldFlatten: true });
              });

            default:
              throw new AppConfigError('$git directive was not passed a valid option');
          }
        },
      ),
    ),
  );
}

interface GitStatus {
  commitRef: string;
  branchName?: string;
  tag?: string;
}

async function gitStatus(): Promise<GitStatus> {
  const git = simpleGit({});

  try {
    const rev = await git.revparse(['HEAD']);
    const branch = await git.revparse(['--abbrev-ref', 'HEAD']);
    const tag = await git.tag(['--points-at', 'HEAD']);

    return {
      commitRef: rev,
      branchName: branch,
      tag: (tag.trim() || undefined)?.split(' ')[0],
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new GitError(error.message);
    }

    throw new GitError('Unknown error');
  }
}
