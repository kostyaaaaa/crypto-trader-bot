import type {
  ConnectionState,
  InitialLogsMessage,
  LogEntry,
  LogsUpdateHandler,
  NewLogMessage,
  NewLogsBatchMessage,
} from '../types';
import { websocketService } from './websocketService';

export class LogsService {
  private allLogs: LogEntry[] = [];
  private updateHandlers: LogsUpdateHandler[] = [];

  constructor() {
    this.setupWebSocketHandlers();
  }

  private setupWebSocketHandlers(): void {
    // Handle initial logs
    websocketService.onMessage('initial_logs', (data) => {
      const message = data as InitialLogsMessage;
      console.log(`Received ${message.data.length} initial logs`);
      this.allLogs = message.data;
      this.notifyHandlers();
    });

    // Handle new single log
    websocketService.onMessage('new_log', (data) => {
      const message = data as NewLogMessage;
      console.log(`New log: ${message.data.level} - ${message.data.message}`);
      this.allLogs = [message.data, ...this.allLogs].slice(0, 500); // Keep latest 500
      this.notifyHandlers();
    });

    // Handle batch of new logs
    websocketService.onMessage('new_logs_batch', (data) => {
      const message = data as NewLogsBatchMessage;
      console.log(`New logs batch: ${message.data.length} logs`);
      this.allLogs = [...message.data, ...this.allLogs].slice(0, 500);
      this.notifyHandlers();
    });

    // Subscribe to logs when connected
    websocketService.onConnection(() => {
      websocketService.send({ type: 'subscribe_logs' });
    });
  }

  private notifyHandlers(): void {
    this.updateHandlers.forEach((handler) => handler([...this.allLogs]));
  }

  // Subscribe to logs updates
  onLogsUpdate(handler: LogsUpdateHandler): () => void {
    this.updateHandlers.push(handler);

    // Call immediately with current logs
    if (this.allLogs.length > 0) {
      handler([...this.allLogs]);
    }

    // Return unsubscribe function
    return () => {
      const index = this.updateHandlers.indexOf(handler);
      if (index > -1) {
        this.updateHandlers.splice(index, 1);
      }
    };
  }

  // Get current logs
  getLogs(): LogEntry[] {
    return [...this.allLogs];
  }

  // Get logs filtered by level
  getLogsByLevel(level: string): LogEntry[] {
    if (level === 'all') {
      return [...this.allLogs];
    }
    return this.allLogs.filter((log) => log.level === level);
  }

  // Get log counts by level
  getLogCounts(): { info: number; warn: number; error: number; total: number } {
    return {
      info: this.allLogs.filter((log) => log.level === 'info').length,
      warn: this.allLogs.filter((log) => log.level === 'warn').length,
      error: this.allLogs.filter((log) => log.level === 'error').length,
      total: this.allLogs.length,
    };
  }

  // Get WebSocket connection state
  getConnectionState(): ConnectionState {
    return websocketService.getConnectionState();
  }
}

// Create singleton instance
export const logsService = new LogsService();
