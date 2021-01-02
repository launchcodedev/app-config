export enum LogLevel {
  Verbose = 'verbose',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
  None = 'none',
}

let isTest = process.env.NODE_ENV === 'test';

export function isTestEnvAndShouldNotPrompt(newValue?: boolean) {
  if (newValue !== undefined) {
    isTest = newValue;
  }

  return isTest;
}

export function checkTTY() {
  return process.stdin.isTTY && process.stdout.isTTY && !isTestEnvAndShouldNotPrompt();
}

let logLevel: LogLevel;

if (process.env.APP_CONFIG_LOG_LEVEL) {
  logLevel = process.env.APP_CONFIG_LOG_LEVEL as LogLevel;
} else if (process.env.NODE_ENV === 'test') {
  logLevel = LogLevel.None;
} else if (checkTTY()) {
  logLevel = LogLevel.Info;
} else {
  logLevel = LogLevel.Warn;
}

export const logger = {
  setLevel(level: LogLevel) {
    logLevel = level;
  },
  verbose(message: string) {
    if (logLevel === LogLevel.Verbose) {
      process.stdout.write(`[app-config][VERBOSE] ${message}\n`);
    }
  },
  info(message: string) {
    if (logLevel === LogLevel.Info || logLevel === LogLevel.Verbose) {
      process.stdout.write(`[app-config][INFO] ${message}\n`);
    }
  },
  warn(message: string) {
    if (logLevel === LogLevel.Warn || logLevel === LogLevel.Info || logLevel === LogLevel.Verbose) {
      process.stderr.write(`[app-config][WARN] ${message}\n`);
    }
  },
  error(message: string) {
    if (
      logLevel === LogLevel.Error ||
      logLevel === LogLevel.Warn ||
      logLevel === LogLevel.Info ||
      logLevel === LogLevel.Verbose
    ) {
      process.stderr.write(`[app-config][ERROR] ${message}\n`);
    }
  },
};

export const setLogLevel = (level: LogLevel) => logger.setLevel(level);
