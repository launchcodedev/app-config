import { AppConfigError } from '@app-config/core';
import { logger } from '@app-config/logging';
import type { PromptObject } from 'prompts';
import prompts from 'prompts';

export async function promptUser<T>(options: Omit<PromptObject, 'name'>): Promise<T> {
  const { named } = await prompts({ ...options, name: 'named' });

  return named as T;
}

export async function promptUserWithRetry<T>(
  options: Omit<PromptObject, 'name'>,
  tryAnswer: (answer: T) => Promise<boolean | Error>,
  retries = 3,
): Promise<void> {
  for (let retry = 0; retry < retries; retry += 1) {
    const answer = await promptUser<T>(options);
    const check = await tryAnswer(answer);

    if (check === true) {
      return;
    }

    logger.error(check.toString());
  }

  return Promise.reject(new AppConfigError(`Prompt failed after ${retries} retries`));
}

export async function consumeStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const buffers: Buffer[] = [];
    process.stdin.on('data', (data) => buffers.push(data));
    process.stdin.on('error', reject);
    process.stdin.on('end', () => resolve(Buffer.concat(buffers).toString('utf8')));
  });
}
