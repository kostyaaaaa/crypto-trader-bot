import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type LogLevel = 'info' | 'error' | 'warn' | 'debug' | 'success';
type LogData = any;

class Logger {
  private static instance: Logger;
  private logsDir: string = '';

  constructor() {
    if (Logger.instance) {
      return Logger.instance;
    }

    this.logsDir = path.join(__dirname, '../logs');
    this.ensureLogsDirectory();

    Logger.instance = this;
    return this;
  }

  private ensureLogsDirectory(): void {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  // Get current timestamp
  private getTimestamp(): string {
    return new Date().toISOString();
  }

  // Get log file path for today
  private getLogFilePath(level: LogLevel): string {
    const today = new Date().toISOString().split('T')[0];
    return path.join(this.logsDir, `${today}-${level}.logs`);
  }

  // Write log to file
  private writeToFile(
    level: LogLevel,
    message: string,
    data: LogData = null,
  ): void {
    const timestamp = this.getTimestamp();
    const logFilePath = this.getLogFilePath(level);

    let logEntry = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

    if (data) {
      if (typeof data === 'object') {
        logEntry += `\nData: ${JSON.stringify(data, null, 2)}`;
      } else {
        logEntry += `\nData: ${data}`;
      }
    }

    logEntry += '\n---\n';

    fs.appendFileSync(logFilePath, logEntry);
  }

  // Info level logging
  info(message: string, data: LogData = null): void {
    console.log(`[INFO] ${message}`, data || '');
    this.writeToFile('info', message, data);
  }

  // Error level logging
  error(message: string, data: LogData = null): void {
    console.error(`[ERROR] ${message}`, data || '');
    this.writeToFile('error', message, data);
  }

  // Warning level logging
  warn(message: string, data: LogData = null): void {
    console.warn(`[WARN] ${message}`, data || '');
    this.writeToFile('warn', message, data);
  }

  // Debug level logging
  debug(message: string, data: LogData = null): void {
    console.log(`[DEBUG] ${message}`, data || '');
    this.writeToFile('debug', message, data);
  }

  // Success level logging
  success(message: string, data: LogData = null): void {
    console.log(`[SUCCESS] ${message}`, data || '');
    this.writeToFile('success', message, data);
  }
}

// Create singleton instance
const logger = new Logger();

export default logger;
