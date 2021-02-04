#!/usr/bin/env node

import { logger } from '@app-config/core';
import { startAgent } from '@app-config/node';

startAgent().catch((error: unknown) => {
  if (error instanceof Error) {
    logger.error(`Error: ${error?.toString()}`);
  } else {
    logger.error('An unknown error occurred');
  }

  process.exit(1);
});
