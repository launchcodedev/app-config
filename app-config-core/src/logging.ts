import { isNode } from './common';

export enum LogLevel {
  Verbose = 'verbose',
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
  None = 'none',
}

let isTest = isNode && process.env.NODE_ENV === 'test';

export function isTestEnvAndShouldNotPrompt(newValue?: boolean) {
  if (newValue !== undefined) {
    isTest = newValue;
  }

  return isTest;
}

export function checkTTY() {
  return isNode && process.stdin.isTTY && process.stdout.isTTY && !isTestEnvAndShouldNotPrompt();
}

export function getInitialLogLevel() {
  if (!isNode) return LogLevel.Warn;

  if (process.env.APP_CONFIG_LOG_LEVEL) {
    return process.env.APP_CONFIG_LOG_LEVEL as LogLevel;
  }

  if (process.env.NODE_ENV === 'test') {
    return LogLevel.None;
  }

  if (checkTTY()) {
    return LogLevel.Info;
  }

  return LogLevel.Warn;
}

type Writer = (message: string) => void;

interface Logger {
  setWriter(write: Writer): void;
  setLevel(level: LogLevel): void;
  verbose(message: string): void;
  info(message: string): void;
  warn(message: string): void;
  error(message: string): void;
}

let logLevel: LogLevel = getInitialLogLevel();
let writeMsg: Writer = process.stderr.write.bind(process.stderr);

export const logger: Logger = {
  setWriter(write: Writer) {
    writeMsg = write;
  },

  setLevel(level: LogLevel) {
    logLevel = level;
  },

  verbose(message: string) {
    switch (logLevel) {
      case LogLevel.Verbose:
        writeMsg(`[app-config][VERBOSE] ${message}\n`);
        break;
      default:
        break;
    }
  },
  info(message: string) {
    switch (logLevel) {
      case LogLevel.Verbose:
      case LogLevel.Info:
        writeMsg(`[app-config][INFO] ${message}\n`);
        break;
      default:
        break;
    }
  },
  warn(message: string) {
    switch (logLevel) {
      case LogLevel.Verbose:
      case LogLevel.Info:
      case LogLevel.Warn:
        writeMsg(`[app-config][WARN] ${message}\n`);
        break;
      default:
        break;
    }
  },
  error(message: string) {
    switch (logLevel) {
      case LogLevel.Verbose:
      case LogLevel.Info:
      case LogLevel.Warn:
      case LogLevel.Error:
        writeMsg(`[app-config][ERROR] ${message}\n`);
        break;
      default:
        break;
    }
  },
};

export const setLogLevel = logger.setLevel;
export const setLogWriter = logger.setWriter;
