export enum LogLevel {
  Verbose = 'verbose',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
  None = 'none',
}

const logLevel = (process.env.APP_CONFIG_LOG_LEVEL as LogLevel) ?? LogLevel.Warn;

export const logger = {
  verbose(message: string) {
    if (
      logLevel === LogLevel.Error ||
      logLevel === LogLevel.Warn ||
      logLevel === LogLevel.Info ||
      logLevel === LogLevel.Verbose
    ) {
      process.stdout.write(`[app-config][VERBOSE] ${message}\n`);
    }
  },
  info(message: string) {
    if (logLevel === LogLevel.Error || logLevel === LogLevel.Warn || logLevel === LogLevel.Info) {
      process.stdout.write(`[app-config][INFO] ${message}\n`);
    }
  },
  warn(message: string) {
    if (logLevel === LogLevel.Error || logLevel === LogLevel.Warn) {
      process.stderr.write(`[app-config][WARN] ${message}\n`);
    }
  },
  error(message: string) {
    if (logLevel === LogLevel.Error) {
      process.stderr.write(`[app-config][ERROR] ${message}\n`);
    }
  },
};
