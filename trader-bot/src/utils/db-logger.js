import winston from 'winston';
import 'winston-mongodb';

class Logger {
  static instance;
  winstonLogger;

  constructor() {
    if (Logger.instance) {
      return Logger.instance;
    }

    this.initializeWinston();
    Logger.instance = this;
    return this;
  }

  initializeWinston() {
    // Get MongoDB URI from environment or use default
    const mongoUri =
      process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto-trader-bot';

    // Define custom format for console output
    const consoleFormat = winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        let logMessage = `[${timestamp}] ${level}: ${message}`;
        if (Object.keys(meta).length > 0) {
          logMessage += `\n${JSON.stringify(meta, null, 2)}`;
        }
        return logMessage;
      }),
    );

    // Define format for MongoDB storage
    const mongoFormat = winston.format.combine(
      winston.format.timestamp(),
      winston.format.json(),
      winston.format.metadata({
        fillExcept: ['message', 'level', 'timestamp'],
      }),
    );

    this.winstonLogger = winston.createLogger({
      level: 'debug',
      format: mongoFormat,
      transports: [
        // Console transport
        new winston.transports.Console({
          format: consoleFormat,
        }),
        // MongoDB transport
        new winston.transports.MongoDB({
          db: mongoUri,
          collection: 'logs',
          level: 'debug',
          storeHost: true,
          capped: true,
          cappedSize: 100000000, // 100MB
          cappedMax: 10000, // Max 10k documents
          format: winston.format.combine(
            winston.format.timestamp(),
            winston.format.json(),
          ),
        }),
      ],
      // Handle exceptions and rejections
      exceptionHandlers: [
        new winston.transports.Console(),
        new winston.transports.MongoDB({
          db: mongoUri,
          collection: 'exceptions',
        }),
      ],
      rejectionHandlers: [
        new winston.transports.Console(),
        new winston.transports.MongoDB({
          db: mongoUri,
          collection: 'rejections',
        }),
      ],
    });
  }

  // Info level logging
  info(message, data = null) {
    this.winstonLogger.info(message, data ? { data } : {});
  }

  // Error level logging
  error(message, data = null) {
    this.winstonLogger.error(message, data ? { data } : {});
  }

  // Warning level logging
  warn(message, data = null) {
    this.winstonLogger.warn(message, data ? { data } : {});
  }

  // Debug level logging
  debug(message, data = null) {
    this.winstonLogger.debug(message, data ? { data } : {});
  }

  // Success level logging (using info level with success metadata)
  success(message, data = null) {
    this.winstonLogger.info(
      message,
      data ? { data, logType: 'success' } : { logType: 'success' },
    );
  }

  // Get the underlying winston logger for advanced usage
  getWinstonLogger() {
    return this.winstonLogger;
  }
}

// Create singleton instance
const logger = new Logger();

export default logger;
