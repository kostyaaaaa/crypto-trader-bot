// Log entry interface based on backend Logs schema
export interface LogEntry {
  _id: string;
  timestamp: Date | string;
  level: 'info' | 'warn' | 'error';
  message: string;
  metadata?: {
    timestamp?: string;
    metadata?: {
      data?: string;
      logType?: string;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
  hostname?: string;
}

// WebSocket message types for logs feature
export interface WebSocketMessage {
  type: 'initial_logs' | 'new_log' | 'new_logs_batch' | 'subscribe_logs';
  data?: LogEntry | LogEntry[] | unknown;
}

export interface InitialLogsMessage extends WebSocketMessage {
  type: 'initial_logs';
  data: LogEntry[];
}

export interface NewLogMessage extends WebSocketMessage {
  type: 'new_log';
  data: LogEntry;
}

export interface NewLogsBatchMessage extends WebSocketMessage {
  type: 'new_logs_batch';
  data: LogEntry[];
}

export interface SubscribeLogsMessage extends WebSocketMessage {
  type: 'subscribe_logs';
  data?: never;
}

export type IncomingMessage =
  | InitialLogsMessage
  | NewLogMessage
  | NewLogsBatchMessage;
export type OutgoingMessage = SubscribeLogsMessage | WebSocketMessage;

// Handler types
export type LogsUpdateHandler = (logs: LogEntry[]) => void;
export type MessageHandler = (data: WebSocketMessage) => void;
