import readline from 'readline';
import prompts from 'prompts';
import type { PromptObject } from 'prompts';
import { AppConfigError } from '@app-config/core';
import { logger } from '@app-config/logging';

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
    const rl = readline.createInterface({ input: process.stdin });

    let buffer = '';
    rl.on('line', (line) => {
      buffer += line;
    });

    rl.on('error', reject);
    rl.on('close', () => resolve(buffer));
  });
}
