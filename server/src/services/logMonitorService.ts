import { LogModel } from 'crypto-trader-db';
import { ChangeStream } from 'mongodb';
import { WebSocket } from 'ws';
import type {
  ILog,
  InitialLogsMessage,
  NewLogMessage,
} from '../types/index.js';
import logger from '../utils/Logger.js';
import type { WebSocketService } from './websocketService.js';

export class LogMonitorService {
  private changeStream: ChangeStream | null = null;
  private websocketService: WebSocketService;

  constructor(websocketService: WebSocketService) {
    this.websocketService = websocketService;

    // Register handler for new WebSocket connections
    this.websocketService.onConnection((ws: WebSocket) => {
      this.sendInitialLogs(ws);
    });

    // Start monitoring immediately
    this.startMonitoring();
  }

  private startMonitoring(): void {
    try {
      // Watch for insert operations on the logs collection
      this.changeStream = LogModel.watch([
        {
          $match: {
            operationType: 'insert',
          },
        },
      ]);

      // Handle change events
      this.changeStream.on('change', (change) => {
        if (change.operationType === 'insert' && change.fullDocument) {
          // Broadcast new log to all clients
          const message: NewLogMessage = {
            type: 'new_log',
            data: change.fullDocument as ILog,
          };
          this.websocketService.broadcast(message);
        }
      });

      // Handle errors
      this.changeStream.on('error', (error) => {
        logger.error('Change stream error:', error);
      });

      logger.info('Log monitoring started');
    } catch (error) {
      logger.error('Failed to start log monitoring:', error);
    }
  }

  stopMonitoring(): void {
    if (this.changeStream) {
      this.changeStream.close();
      this.changeStream = null;
    }
    logger.info('Log monitoring stopped');
  }

  private async sendInitialLogs(ws: WebSocket): Promise<void> {
    try {
      const logs = await LogModel.findLatest(200);
      const message: InitialLogsMessage = {
        type: 'initial_logs',
        data: logs,
      };
      this.websocketService.sendToClient(ws, message);
    } catch (error) {
      logger.error('Error sending initial logs:', error);
    }
  }
}
