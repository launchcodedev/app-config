export enum LogLevel {
  Verbose = 'verbose',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
  None = 'none',
}

export function checkTTY() {
  return process.stdin.isTTY && process.stdout.isTTY;
}

let logLevel =
  (process.env.APP_CONFIG_LOG_LEVEL as LogLevel) ?? checkTTY() ? LogLevel.Info : LogLevel.Warn;

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
