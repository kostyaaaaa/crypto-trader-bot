// Generic WebSocket service types
export type ConnectionHandler = () => void;
export type ErrorHandler = (error: Event) => void;
export type ConnectionState = 'connected' | 'connecting' | 'disconnected';

// Re-export logs-specific types for convenience
export type {
  IncomingMessage,
  InitialLogsMessage,
  LogEntry,
  MessageHandler,
  NewLogMessage,
  NewLogsBatchMessage,
  OutgoingMessage,
  SubscribeLogsMessage,
  WebSocketMessage,
} from '../logs';
