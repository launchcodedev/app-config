import { isBrowser } from './common';

export enum LogLevel {
  Verbose = 'verbose',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
  None = 'none',
}

const stdout = isBrowser ? process.stdout.write : console.log;
const stderr = isBrowser ? process.stderr.write : console.error;

let logLevel: LogLevel = LogLevel.Warn;

if (typeof jest !== 'undefined') {
  logLevel = LogLevel.None;
}

export const logger = {
  setLevel(level: LogLevel) {
    logLevel = level;
  },
  verbose(message: string) {
    if (logLevel === LogLevel.Verbose) {
      stdout(`[app-config][VERBOSE] ${message}\n`);
    }
  },
  info(message: string) {
    if (logLevel === LogLevel.Info || logLevel === LogLevel.Verbose) {
      stdout(`[app-config][INFO] ${message}\n`);
    }
  },
  warn(message: string) {
    if (logLevel === LogLevel.Warn || logLevel === LogLevel.Info || logLevel === LogLevel.Verbose) {
      stderr(`[app-config][WARN] ${message}\n`);
    }
  },
  error(message: string) {
    if (
      logLevel === LogLevel.Error ||
      logLevel === LogLevel.Warn ||
      logLevel === LogLevel.Info ||
      logLevel === LogLevel.Verbose
    ) {
      stderr(`[app-config][ERROR] ${message}\n`);
    }
  },
};

export const setLogLevel = (level: LogLevel) => logger.setLevel(level);
