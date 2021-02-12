#!/usr/bin/env node

import { logger } from '@app-config/logging';
import { startAgent } from '@app-config/encryption';

startAgent().catch((error: unknown) => {
  if (error instanceof Error) {
    logger.error(`Error: ${error?.toString()}`);
  } else {
    logger.error('An unknown error occurred');
  }

  process.exit(1);
});
