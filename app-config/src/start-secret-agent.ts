#!/usr/bin/env node

import { startAgent } from './secret-agent';
import { logger } from './logging';

startAgent().catch((error: unknown) => {
  if (error instanceof Error) {
    logger.error(`Error: ${error?.toString()}`);
  } else {
    logger.error('An unknown error occurred');
  }

  process.exit(1);
});
