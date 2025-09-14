import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class Logger {
  constructor() {
    if (Logger.instance) {
      return Logger.instance;
    }

    this.logsDir = path.join(__dirname, '../logs');
    this.ensureLogsDirectory();

    Logger.instance = this;
    return this;
  }

  // Ensure logs directory exists
  ensureLogsDirectory() {
    if (!fs.existsSync(this.logsDir)) {
      fs.mkdirSync(this.logsDir, { recursive: true });
    }
  }

  // Get current timestamp
  getTimestamp() {
    return new Date().toISOString();
  }

  // Get log file path for today
  getLogFilePath(level) {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return path.join(this.logsDir, `${today}-${level}.logs`);
  }

  // Write log to file
  writeToFile(level, message, data = null) {
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
  info(message, data = null) {
    console.log(`[INFO] ${message}`, data || '');
    this.writeToFile('info', message, data);
  }

  // Error level logging
  error(message, data = null) {
    console.error(`[ERROR] ${message}`, data || '');
    this.writeToFile('error', message, data);
  }

  // Warning level logging
  warn(message, data = null) {
    console.warn(`[WARN] ${message}`, data || '');
    this.writeToFile('warn', message, data);
  }

  // Debug level logging
  debug(message, data = null) {
    console.log(`[DEBUG] ${message}`, data || '');
    this.writeToFile('debug', message, data);
  }

  // Success level logging
  success(message, data = null) {
    console.log(`[SUCCESS] ${message}`, data || '');
    this.writeToFile('success', message, data);
  }
}

// Create singleton instance
const logger = new Logger();

export default logger;
