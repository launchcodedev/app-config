import simpleGit from 'simple-git';
import { ParsingExtension, AppConfigError } from '@app-config/core';

/** Access to the git branch and commit ref */
export default function gitRefDirectives(
  getStatus: typeof gitStatus = gitStatus,
): ParsingExtension {
  return (value, [_, key]) => {
    if (key === '$git') {
      return async (parse) => {
        if (typeof value !== 'string') {
          throw new AppConfigError('$git directive should be passed a string');
        }

        switch (value) {
          case 'commit':
            return getStatus().then(({ commitRef }) => parse(commitRef, { shouldFlatten: true }));

          case 'commitShort':
            return getStatus().then(({ commitRef }) =>
              parse(commitRef.slice(0, 7), { shouldFlatten: true }),
            );

          case 'branch':
            return getStatus().then(({ branchName }) => {
              if (!branchName) {
                throw new AppConfigError(
                  'The $git directive tried to retrieve branchname, but it appears no branch is checked out',
                );
              }

              return parse(branchName, { shouldFlatten: true });
            });

          default:
            throw new AppConfigError('$git directive was not passed a valid option');
        }
      };
    }

    return false;
  };
}

interface GitStatus {
  commitRef: string;
  branchName?: string;
}

async function gitStatus(): Promise<GitStatus> {
  const git = simpleGit({});
  const rev = await git.revparse(['HEAD']);
  const branch = await git.revparse(['--abbrev-ref', 'HEAD']);

  return {
    commitRef: rev,
    branchName: branch,
  };
}
