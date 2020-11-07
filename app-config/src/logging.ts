export enum LogLevel {
  Verbose = 'verbose',
  Info = 'info',
  Warn = 'warn',
  None = 'none',
}

const logLevel = (process.env.APP_CONFIG_LOG_LEVEL as LogLevel) ?? LogLevel.Warn;

export const logger = {
  verbose(message: string) {
    if (logLevel === LogLevel.Warn || logLevel === LogLevel.Info || logLevel === LogLevel.Verbose) {
      console.log(`[app-config][VERBOSE] ${message}`);
    }
  },
  info(message: string) {
    if (logLevel === LogLevel.Warn || logLevel === LogLevel.Info) {
      console.log(`[app-config][INFO] ${message}`);
    }
  },
  warn(message: string) {
    if (logLevel === LogLevel.Warn) {
      console.log(`[app-config][WARN] ${message}`);
    }
  },
};
