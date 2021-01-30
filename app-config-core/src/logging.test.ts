import { logger, LogLevel, getInitialLogLevel } from './logging';

describe('logging', () => {
  it('logs verbose messages', () => {
    const writeMsg = jest.fn();
    logger.setWriter(writeMsg);
    logger.setLevel(LogLevel.Verbose);

    logger.verbose('hello world');
    logger.info('information');
    logger.warn('warning');
    logger.error('error');

    expect(writeMsg).toHaveBeenCalledWith('[app-config][VERBOSE] hello world\n');
    expect(writeMsg).toHaveBeenCalledWith('[app-config][INFO] information\n');
    expect(writeMsg).toHaveBeenCalledWith('[app-config][WARN] warning\n');
    expect(writeMsg).toHaveBeenCalledWith('[app-config][ERROR] error\n');
  });

  it('respects LogLevel.Warn', () => {
    const writeMsg = jest.fn();
    logger.setWriter(writeMsg);
    logger.setLevel(LogLevel.Warn);

    logger.verbose('hello world');
    logger.info('information');
    logger.warn('warning');
    logger.error('error');

    expect(writeMsg).not.toHaveBeenCalledWith('[app-config][VERBOSE] hello world\n');
    expect(writeMsg).not.toHaveBeenCalledWith('[app-config][INFO] information\n');
    expect(writeMsg).toHaveBeenCalledWith('[app-config][WARN] warning\n');
    expect(writeMsg).toHaveBeenCalledWith('[app-config][ERROR] error\n');
  });

  it('respects LogLevel.None', () => {
    const writeMsg = jest.fn();
    logger.setWriter(writeMsg);
    logger.setLevel(LogLevel.None);

    logger.verbose('hello world');
    logger.info('information');
    logger.warn('warning');
    logger.error('error');

    expect(writeMsg).not.toHaveBeenCalled();
  });

  it('uses APP_CONFIG_LOG_LEVEL', () => {
    expect(getInitialLogLevel()).toBe(LogLevel.None);

    process.env.NODE_ENV = '';
    expect(getInitialLogLevel()).toBe(LogLevel.Warn);

    process.env.APP_CONFIG_LOG_LEVEL = 'verbose';
    expect(getInitialLogLevel()).toBe(LogLevel.Verbose);
  });
});
