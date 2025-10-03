import type { ILog } from 'crypto-trader-db';

// WebSocket message types for server-side
export interface WebSocketMessage {
  type: string;
  data?: unknown;
}

export interface InitialLogsMessage extends WebSocketMessage {
  type: 'initial_logs';
  data: ILog[];
}

export interface NewLogMessage extends WebSocketMessage {
  type: 'new_log';
  data: ILog;
}

export interface NewLogsBatchMessage extends WebSocketMessage {
  type: 'new_logs_batch';
  data: ILog[];
}

export interface SubscribeLogsMessage extends WebSocketMessage {
  type: 'subscribe_logs';
  data?: never;
}

export type OutgoingMessage = InitialLogsMessage | NewLogMessage | NewLogsBatchMessage;
export type IncomingMessage = SubscribeLogsMessage | WebSocketMessage;

// WebSocket client message handler types
export type ClientMessageHandler = (message: IncomingMessage) => void;
